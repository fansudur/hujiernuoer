// Pure display geometry and source matching. No observed historical weather is synthesized.
export const CENTER={latitude:49.132794782364805,longitude:119.69156942008443};
export function sceneDate(month,day=21){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return null;
 const [y,m]=month.split('-').map(Number),max=new Date(Date.UTC(y,m,0)).getUTCDate();
 if(!Number.isFinite(+day))return null;
 return `${month}-${String(Math.min(max,Math.max(1,Math.floor(+day)))).padStart(2,'0')}`;
}
export function solarAtDate(date,solarHour=12,latitude=CENTER.latitude){
 if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date)||!Number.isFinite(+solarHour)||solarHour<0||solarHour>24||!Number.isFinite(latitude)||Math.abs(latitude)>90)return null;
 const [year,month,day]=date.split('-').map(Number),stamp=Date.UTC(year,month-1,day),d=new Date(stamp);
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
 const J=Math.floor((stamp-Date.UTC(year,0,1))/86400000)+1;
 // Exactly the approximate declination model used in the frozen research's geometry display.
 // This is not a year-specific ephemeris or measured sunshine. Leap dates use actual ordinal J.
 const delta=.409*Math.sin(2*Math.PI*J/365-1.39),phi=latitude*Math.PI/180,H=(solarHour-12)*Math.PI/12;
 const east=-Math.cos(delta)*Math.sin(H),north=Math.cos(phi)*Math.sin(delta)-Math.sin(phi)*Math.cos(delta)*Math.cos(H),up=Math.sin(phi)*Math.sin(delta)+Math.cos(phi)*Math.cos(delta)*Math.cos(H);
 const altitude=Math.asin(Math.max(-1,Math.min(1,up)))*180/Math.PI,azimuth=(Math.atan2(east,north)*180/Math.PI+360)%360;
 return {date,solar_hour:+solarHour,time_basis:'local_apparent_solar_time',day_of_year:J,latitude_deg:latitude,azimuth_deg_from_true_north:azimuth,altitude_deg:altitude,above_geometric_horizon:altitude>0,unit_vector_enu:[east,north,up],unit_vector_three_east_up_south:[east,up,-north],model:'approximate FAO-type solar geometry; not measured sunshine or image-acquisition lighting'};
}
export function selectSameMonthSatellite(scenes,month,day=21){
 const target=sceneDate(month,day);if(!target)return null;
 const targetDay=+target.slice(8);
 return scenes.filter(s=>s?.date?.slice(0,7)===month&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)).sort((a,b)=>Math.abs(+a.date.slice(8)-targetDay)-Math.abs(+b.date.slice(8)-targetDay)||a.date.localeCompare(b.date))[0]||null;
}
export function selectMonthlyWind(rows,month){return rows.find(r=>r.date===month)||null;}
