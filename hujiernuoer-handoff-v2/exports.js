/* Data-only exports. GeoJSON foreign members carry month availability and quality metadata. */
(function(root){
  'use strict';
  function keys(db,lakeKey){
    if(lakeKey==='BOTH')return Object.keys(db.water.lakes);
    if(!Object.hasOwn(db.water.lakes,lakeKey))throw new RangeError('Unknown lake: '+lakeKey);
    return [lakeKey];
  }
  function readPart(db,path){if(!path)return null;const part=db.waterData[path];if(!part)throw Error('Missing frozen collection '+path);return part;}
  function partState(db,path){
    const p=readPart(db,path);return p?(p.features.length?'provided_nonempty':'provided_empty'):'unavailable';
  }
  function annotated(f,extra){
    const {_paths,_bounds,...src}=f;
    return {...src,properties:{...src.properties,...extra}};
  }
  function month(db,lakeKey,date){
    if(!db.water.dates.includes(date))throw new RangeError('Month outside archive: '+date);
    const result={type:'FeatureCollection', schema:'hujiernuoer/spatial-water-export/v2',selection:{date,lake_ids:keys(db,lakeKey)},month_records:[],features:[]};
    for(const lake of result.selection.lake_ids){
      const ser=db.water.lakes[lake],row=ser.months[date];
      result.month_records.push({lake_id:lake,date,...row,water_geometry:partState(db,row.water),nodata_geometry:partState(db,row.nodata)});
      result.features.push(...readPart(db,ser.boundary).features.map(f=>annotated(f,{archive_lake_id:lake,archive_kind:'boundary'})));
      for(const kind of ['water','nodata']){
        const part=readPart(db,row[kind]);if(!part)continue;
        result.features.push(...part.features.map(f=>annotated(f,{archive_lake_id:lake,archive_month:date,archive_kind:kind,status:row.status,qualification:row.qualification,area_ha:row.area_ha,valid_pct:row.valid_pct,classification_disputed:row.classification_disputed===true,classification_note:row.classification_note||null})));
      }
    }
    return result;
  }
  function all(db){
    const water=db.water, out={type:'FeatureCollection',schema:'hujiernuoer/spatial-water-export/v2',selection:{date_range:[water.dates[0],water.dates.at(-1)],lake_ids:Object.keys(water.lakes)},month_records:[],features:[]};
    const ids=new Set();
    for(const date of water.dates){
      const m=month(db,'BOTH',date);
      out.month_records.push(...m.month_records);
      for(const f of m.features)if(!ids.has(f.id)){ids.add(f.id);out.features.push(f);}
    }
    return out;
  }
  function comparison(db,axis,date,lakeKey){
    if(!db.water.dates.includes(date))throw new RangeError('Unknown month '+date);
    if(!['same-month','same-year'].includes(axis))throw new RangeError('Unknown comparison axis '+axis);
    const dates=db.water.dates.filter(d=>axis==='same-month'?d.slice(5)===date.slice(5):d.slice(0,4)===date.slice(0,4));
    return dates.map(d=>({date:d,lakes:Object.fromEntries(keys(db,lakeKey).map(key=>[key,db.water.lakes[key].months[d]]))}));
  }
  const api={month,all,comparison};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.AtlasExports=api;
})(globalThis);
