from osgeo import gdal,osr
import numpy as np,json,pathlib,hashlib,shutil
R=pathlib.Path('/workspace/shared/alkali_annual_water'); O=pathlib.Path(__file__).parent
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
scenes=json.loads((R/'scene_results.json').read_text()); features={f['id']:f for f in json.loads((R/'source_manifest.json').read_text())['features']}
base=gdal.Open(str(R/'roi'/f"{scenes[0]['id']}_rgb.tif"));gt=base.GetGeoTransform();proj=base.GetProjection()
s=osr.SpatialReference();s.ImportFromEPSG(32650);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
w=osr.SpatialReference();w.ImportFromEPSG(4326);w.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tr=osr.CoordinateTransformation(s,w)
cs=[tr.TransformPoint(x,y)[:2] for x,y in [(694600,5444400),(698000,5444400),(698000,5446800),(694600,5446800)]]
bbox=[min(x[0] for x in cs),min(x[1] for x in cs),max(x[0] for x in cs),max(x[1] for x in cs)]
m=osr.SpatialReference();m.ImportFromEPSG(3857);m.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);tm=osr.CoordinateTransformation(w,m);mb1=tm.TransformPoint(*bbox[:2]);mb2=tm.TransformPoint(*bbox[2:]);mb=[*mb1[:2],*mb2[:2]]
rows=[]
for r in scenes:
 sid=r['id']; f=features[sid]; src=R/'roi'/f'{sid}_rgb.tif'; ds=gdal.Open(str(src)); assert ds.GetGeoTransform()==gt and ds.GetProjection()==proj and (ds.RasterXSize,ds.RasterYSize)==(170,120)
 rgb=ds.ReadAsArray(); raw=[gdal.Open(str(R/'roi'/f'{sid}_{b}.tif')).ReadAsArray() for b in ['red','green','blue']]; scl=gdal.Open(str(R/'roi'/f'{sid}_scl.tif')).ReadAsArray(); nodata=(scl==0)|np.any(np.stack(raw)==0,axis=0)
 rgba=gdal.GetDriverByName('MEM').Create('',170,120,4,gdal.GDT_Byte);rgba.SetProjection(proj);rgba.SetGeoTransform(gt)
 for i in range(3):rgba.GetRasterBand(i+1).WriteArray(rgb[i]);rgba.GetRasterBand(i+1).SetColorInterpretation([gdal.GCI_RedBand,gdal.GCI_GreenBand,gdal.GCI_BlueBand][i])
 rgba.GetRasterBand(4).WriteArray(np.where(nodata,0,255).astype('uint8'));rgba.GetRasterBand(4).SetColorInterpretation(gdal.GCI_AlphaBand)
 out={}
 for epsg,extent,suffix in [(3857,mb,'mercator'),(4326,bbox,'geographic')]:
  warped=gdal.Warp('',rgba,format='MEM',dstSRS=f'EPSG:{epsg}',outputBounds=extent,width=176,height=128,resampleAlg='bilinear',srcAlpha=True,dstAlpha=True)
  name=f'{r["date"]}_truecolor_{suffix}.png';gdal.Translate(str(O/name),warped,format='PNG');out[suffix]={'path':name,'sha256':sha(O/name),'crs':f'EPSG:{epsg}','bounds':extent,'size_px':[176,128]}
 rows.append({'id':sid,'date':r['date'],'datetime':f['properties']['datetime'],'label':r['date']+' · Sentinel-2 真彩色（B04/B03/B02）','kind':'satellite_true_color','bands':['B04 red','B03 green','B02 blue'],'assets':out,'bounds_wgs84':bbox,'coordinates':[[bbox[0],bbox[3]],[bbox[2],bbox[3]],[bbox[2],bbox[1]],[bbox[0],bbox[1]]],'source':{'local_path':str(src),'sha256':sha(src),'crs':'EPSG:32650','geotransform':gt,'size_px':[170,120],'pixel_m':20,'nodata_tag':None,'stac':next(l['href'] for l in f['links'] if l['rel']=='self'),'band_urls':{b:f['assets'][b]['href'] for b in ['red','green','blue']},'license_links':[l['href'] for l in f['links'] if l['rel']=='license']},'quality':{'usable_in_original_summer_series':r.get('usable',False),'valid_fraction_fixed_lake_window':r.get('total_valid_fraction'),'display_transparent_nodata_pixels':int(nodata.sum()),'clouds_not_hidden':'云/阴影仍可见；透明仅用于原始无数据（SCL=0或RGB任一原波段DN=0），不能把云当水面变化。','partial_observation':not r.get('usable',False)},'context_only_original_spectral_water_ha':r.get('total_central_ha'),'warnings':['这是可见光反射率真彩色显示，不是水分类图。','代表景不能替代全年/同月多景统计；0检出不等于干涸。']})
manifest={'version':1,'title':'原地理栅格重投影的同域 Sentinel-2 真彩色','attribution':'Contains modified Copernicus Sentinel data. 来源：现有 Earth Search Sentinel-2 L2A COG 裁剪档案。','display_transform':'原脚本以校正反射率 R/G/B：clip(reflectance/0.3,0,1) ** (1/1.6) * 255；所有日期相同显示转换，原始10m可见光已按平均法降到20m。此次仅双线性重投影，不新增地物细节。','alignment':{'status':'source_grid_identical_and_reprojected_to_common_grid','verified_all_dates':True,'source_crs':'EPSG:32650','source_bounds':[694600,5444400,698000,5446800],'source_grid':[170,120],'ground_control_validation':False,'caution':'已验证共同CRS/仿射变换/网格；依赖产品正射地理参考，未做地面控制点亚像元配准检验。不得声称达到实测地籍精度。','usage':'2D Web Mercator 地图用 mercator；Cesium geographic rectangle 用 geographic。所有日期bbox一致。'},'bbox_wgs84':bbox,'image_count':len(rows),'default_pair':['2023-08-25','2024-08-16'],'comparison_pairs':[{'id':'same_month','label':'同月跨年：2023-08-25 ↔ 2024-08-16','dates':['2023-08-25','2024-08-16'],'caution':'同为8月，不同具体日；不据此单独判断全年单调趋势。'},{'id':'same_year','label':'同年季节内：2023-07-26 ↔ 2023-08-25','dates':['2023-07-26','2023-08-25'],'caution':'同年不同月对比，不是跨年趋势。'},{'id':'recent','label':'近期同月：2025-08-04 ↔ 2026-08-08','dates':['2025-08-04','2026-08-08'],'caution':'2026夏季仅两景合格8月观测；不能推断7月。'}],'scenes':rows,'provenance_files':[{ 'path':str(R/n),'sha256':sha(R/n)} for n in ['analyze_annual.py','source_manifest.json','scene_results.json','grid_and_windows.json']],'intentional_omissions':['不复制原始多波段大栅格与2GB档案。','不把水面分类栅格当真彩色。','未对无配准的报告截图作贴地处理。','2016无真实影像、2018两景仅部分观测；不补零、不假造图像。']}
(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));
for p in O.glob('*.aux.xml'):p.unlink()
print(json.dumps({'count':len(rows),'bbox':bbox,'size_bytes':sum(p.stat().st_size for p in O.glob('*'))}))
