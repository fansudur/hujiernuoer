export function nextTimelineDate(eligible, current) {
  return eligible.find(date => date > current) || eligible[0];
}

export function representativeTimelineScene(date, scenes) {
  return (scenes || []).find(scene => scene.broad && scene.url
    && /^\d{4}-\d{2}-\d{2}$/.test(scene.date)
    && scene.date.slice(0, 7) === date) || null;
}

// Existing v13 archive display raster (uniform_canvas.original_source).
export const TIMELINE_REFERENCE_SCENE = Object.freeze({
  id:'S2B_T50UPV_20240702T025820_L2A',
  scene_id:'S2B_T50UPV_20240702T025820_L2A',
  date:'2024-07-02',
  time_utc:'2024-07-02T03:04:19.332000Z',
  url:'./timeline-2024-07-02-sentinel.png',
  bounds_wgs84:[119.53943514644351,49.069522613065324,119.81056485355649,49.260477386934674],
  sha256:'97361ac66f03985693b79318217163c268ecf0db36f4125c6d76339ecd0dbd33',
  broad:true,
});

const validMonth = value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value||'');
export function isUsableWaterMonth(index,date,scope='BOTH'){
  const ids=scope==='BOTH'?['MAIN','WF1']:[scope];
  return ids.some(id=>['positive','zero'].includes(index?.lakes?.[id]?.months?.[date]?.status));
}
export function createTimelineCalendar(index, registeredImageMonths=[], additionalObservationMonths=[]){
  const observations=new Set(additionalObservationMonths.filter(validMonth));
  const images=new Set(registeredImageMonths.filter(validMonth));
  const archived=(index?.dates||[]).filter(validMonth);
  const water=new Set(archived.filter(d=>isUsableWaterMonth(index,d)));
  const available=[...new Set([...water,...images,...observations])].sort();
  const endpoints=[...archived,...images,...observations].sort();
  const full=[];
  if(endpoints.length){
    const first=endpoints[0], last=endpoints.at(-1);
    let year=Number(first.slice(0,4)),month=Number(first.slice(5,7)),current=first;
    while(current<=last){
      full.push(current);
      if(++month>12){month=1;year++;}
      current=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0');
    }
  }
  return {available,full,availableSet:new Set(available),fullSet:new Set(full),images,water,observations};
}
export function relativeTimelineDate(dates,current,direction){
  return direction<0?dates.findLast(date=>date<current):dates.find(date=>date>current);
}
export function filterTimelineAxis(dates,anchor,axis){
  if(!validMonth(anchor))return [];
  return dates.filter(d=>axis==='same-year'?d.slice(0,4)===anchor.slice(0,4):d.slice(5,7)===anchor.slice(5,7));
}
