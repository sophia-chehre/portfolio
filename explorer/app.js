'use strict';
const $=id=>document.getElementById(id);
let catalog,city='bochum_langendreer',source='microsoft',mode='agreement',map,referenceLayer,candidateLayer,gridLayer,windowLayer,boundaryLayer;
let frames={},selectionHighlight;let activeToken=0;
const colours={overlap_match:'#208b7d',review_overlap:'#d8aa3d',unpaired:'#ce6657',reference:'#728cac'};
const labels={overlap_match:'Overlap match',review_overlap:'Review overlap',unpaired:'Unpaired outline'};
const cache=new Map();
async function read(name){if(!cache.has(name))cache.set(name,fetch('data/'+name).then(r=>{if(!r.ok)throw Error('Data unavailable: '+name);return r.json();}));return cache.get(name);}
const number=(v,d=0)=>new Intl.NumberFormat('en',{maximumFractionDigits:d}).format(v);
function text(el,value){$(el).textContent=value;}
function selectedWindow(){return catalog.windows.find(w=>w.id===city);}
function loading(on,msg='Reading the source comparison…'){$('loading').hidden=!on;text('loadMessage',msg);}
function initMap(){
 map=L.map('map',{preferCanvas:true,zoomControl:false,minZoom:11,maxZoom:20,scrollWheelZoom:true}).setView([51.48,7.22],15);
 L.control.zoom({position:'topright'}).addTo(map);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 map.attributionControl.addAttribution('Geobasis NRW · Microsoft');
 L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
 map.on('click',()=>{$('selection').hidden=true;if(selectionHighlight){map.removeLayer(selectionHighlight);selectionHighlight=null;}});
}
function inspect(feature,layer){
 const p=feature.properties;
 text('selectionTitle',labels[p.comparison_status]||'Official reference');text('selectionId',p.source_id||p.cell_id);
 const details=[['Source',catalog.sources[p.source]?.short||'200 m grid'],['Area',p.area_m2!=null?number(p.area_m2,1)+' m²':'—'],['Best IoU',p.best_iou!=null?number(p.best_iou,3):'—'],['Municipality key',p.municipality_ags||selectedWindow().ags]];
 if(p.count_difference!=null){details.splice(0,3,['Official count',p.reference_count],['Compared count',p.candidate_count],['Count difference',(p.count_difference>0?'+':'')+p.count_difference]);}
 if(p.split_merge_review)details.push(['Geometry grouping','Split / merge candidate']);
 $('selectionDetails').replaceChildren(...details.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return[dt,dd];}));
 text('selectionNote',p.count_difference!=null?'Counts use representative-point allocation to non-overlapping 200 m cells. This is an analytical grid, not official neighbourhoods.':p.comparison_status==='unpaired'?'No intersecting reference outline was found. Different observation dates, object definitions and omissions can all explain this; it is not automatically a false detection.':p.comparison_status==='review_overlap'?'An overlap exists below the 0.5 IoU rule. Roof/ground differences, splits, merges and dates should be reviewed.':'IoU is intersection divided by union. An overlap match describes geometric agreement against this reference, not certainty about the real world.');
 $('selection').hidden=false;
 if(selectionHighlight)map.removeLayer(selectionHighlight);
 selectionHighlight=L.geoJSON(feature,{style:{color:'#18333e',weight:3,fillOpacity:.08},interactive:false}).addTo(map);
}
function onFeature(f,l){l.on('click',e=>{L.DomEvent.stopPropagation(e.originalEvent);inspect(f,l);});}
function removeLayers(){for(const l of [referenceLayer,candidateLayer,gridLayer,windowLayer,boundaryLayer,selectionHighlight])if(l)map.removeLayer(l);selectionHighlight=null;}
function styleCandidate(f){return{color:mode==='sources'?catalog.sources[source].colour:colours[f.properties.comparison_status],weight:1,opacity:.9,fillOpacity:.42};}
function draw(){
 removeLayers();const w=selectedWindow();
 boundaryLayer=L.geoJSON(frames.boundary,{style:{color:'#667c81',weight:1.3,dashArray:'5 6',fill:false},interactive:false}).addTo(map);
 windowLayer=L.rectangle([[w.bbox[1],w.bbox[0]],[w.bbox[3],w.bbox[2]]],{color:'#3a555d',weight:1.4,dashArray:'6 5',fill:false,interactive:false}).addTo(map);
 const filtered=frames.candidate.features.filter(f=>$('filter').value==='all'||($('filter').value==='split'?f.properties.split_merge_review:f.properties.comparison_status===$('filter').value));
 if(mode==='grid'){
  const max=Math.max(...frames.grid.features.map(f=>Math.abs(f.properties.count_difference)),1);
  gridLayer=L.geoJSON(frames.grid,{style:f=>({color:'#fff',weight:.5,fillColor:f.properties.count_difference>=0?'#27867d':'#ce8564',fillOpacity:.12+.7*Math.sqrt(Math.abs(f.properties.count_difference)/max)}),onEachFeature:onFeature}).addTo(map);
 }else{
  if($('referenceToggle').checked)referenceLayer=L.geoJSON(frames.reference,{style:{color:'#6e87a3',weight:.55,opacity:.7,fillColor:'#a0aebe',fillOpacity:.15},onEachFeature:onFeature}).addTo(map);
  candidateLayer=L.geoJSON({type:'FeatureCollection',features:filtered},{style:styleCandidate,onEachFeature:onFeature}).addTo(map);
 }
 text('visibleCount',number(filtered.length)+' shown');text('mapWindowLabel',w.name.toUpperCase());
 text('mapModeLabel',mode==='grid'?'200 M COUNT DIFFERENCES':mode==='sources'?'SOURCE OUTLINES':'OVERLAP AGREEMENT');
 $('filter').disabled=mode==='grid';$('referenceToggle').disabled=mode==='grid';
 if(mode==='grid')$('legend').innerHTML='<b>Compared minus official · outlines per 200 m cell</b><div><span class="key" style="background:#ce8564"></span>Fewer <span class="key" style="background:#27867d"></span>More</div><small>Analytical grid, not official administrative areas.</small>';
 else if(mode==='sources')$('legend').innerHTML='<b>Different sources, same study window</b><div><span class="key" style="background:#728cac"></span>Official reference <span class="key" style="background:'+catalog.sources[source].colour+'"></span>'+catalog.sources[source].short+'</div><small>Source geometries retain their original definitions.</small>';
 else $('legend').innerHTML='<b>Overlap against the official reference · IoU ≥ 0.5</b><div><span class="key matched"></span>Overlap match <span class="key review"></span>Review overlap <span class="key unpaired"></span>Unpaired</div><small>Unpaired does not automatically mean incorrect.</small>';
}
function updateStats(){
 const w=selectedWindow(),s=w.comparisons[source];
 text('sourceCount',number(s.candidate_features));text('matchRate',number(s.reference_overlap_match_pct,1)+'%');
 text('adminType',w.admin_type);text('ags',w.ags);text('district',w.district);
 const d=w.boundary_date;text('boundaryDate','Boundary: '+d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8));
 const max=Math.max(...Object.values(w.source_counts));
 $('bars').replaceChildren(...Object.entries(w.source_counts).map(([key,n])=>{const row=document.createElement('div');row.className='bar-row';const label=document.createElement('span');label.textContent=catalog.sources[key].short;const track=document.createElement('div');track.className='bar-track';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=n/max*100+'%';fill.style.background=catalog.sources[key].colour;track.append(fill);const value=document.createElement('strong');value.textContent=number(n);row.append(label,track,value);return row;}));
}
async function loadWindow(fit=true){
 const token=++activeToken;loading(true);$('selection').hidden=true;
 try{
  const [reference,candidate,grid,boundary]=await Promise.all([read(`${city}_reference_${source}.geojson`),read(`${city}_${source}.geojson`),read(`${city}_${source}_grid.geojson`),read(`${city}_municipality.geojson`)]);
  if(token!==activeToken)return;frames={reference,candidate,grid,boundary};updateStats();draw();
  if(fit)fitWindow();loading(false);
 }catch(e){text('loadMessage',e.message+'. Serve this folder over HTTP; data loading may be blocked on file://.');$('loading').querySelector('strong').textContent='The data could not be loaded';console.error(e);}
}
function fitWindow(){const b=selectedWindow().bbox;map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[30,35]});}
function method(){
 const w=selectedWindow(),s=w.comparisons[source];
 const html=`<p>The planning question: how does choosing a building dataset change the inventory available to a municipal analysis, and where should a planner inspect disagreements?</p>
 <h3>Scope and German administrative context</h3><p>One 2 × 2 km window in Bochum and one in Witten. These are selected study windows (Bochum-Langendreer and central Witten), not complete municipal inventories. Official municipality keys retain their leading zeroes. Bochum is a kreisfreie Stadt; Witten belongs to Ennepe-Ruhr-Kreis. Detailed DVG boundaries validate the assignment. The 200 m map cells are an analytical grid, not Stadtteile.</p>
 <h3>1 / Select comparable objects</h3><p>The official ALKIS service includes building parts and other structures. Only AX_Gebaeude (object code 31001) is retained; parts and other planar structures are excluded. OpenStreetMap building polygons and relations are reconstructed. Microsoft outlines are a published model-derived source. Geometry is repaired where necessary and exact duplicate shapes removed. Full geometries are selected by a representative point inside the window; they are not clipped for area calculation.</p>
 <h3>2 / Make the comparison inspectable</h3><p>All area calculations use ETRS89 / UTM32 (EPSG:25832). Intersecting candidate/reference pairs are compared with Intersection over Union. A pair with IoU ≥ 0.5 is an overlap match. Unique reference features determine the percentage; multiple candidates cannot inflate the denominator. Lower-IoU overlaps remain review cases. Potential split/merge groupings are flagged, not forced into a one-to-one ground-truth claim.</p>
 <h3>3 / Check the threshold</h3><p>For ${w.name} / ${catalog.sources[source].short}, the unique reference matches at three IoU rules are:</p><table><tr><th>IoU rule</th><th>Reference matches</th><th>Reference denominator</th></tr>${Object.entries(s.sensitivity).map(([k,v])=>`<tr><td>≥ ${k}</td><td>${number(v)}</td><td>${number(s.reference_features)}</td></tr>`).join('')}</table>
 <h3>4 / Interpret with limits</h3><p>Different dates, building definitions, roof versus ground outlines, omissions, additions and geometric grouping can explain disagreement. The official layer is a dated reference, not infallible truth. The map does not establish when a real building appeared or disappeared, measure model training quality, estimate floor area or determine legal building potential. Reported area is the sum of selected polygon areas, not a claim about sealed land.</p>
 <h3>5 / Reproduce and deliver</h3><p>The Python workflow writes a source manifest with retrieval URLs, timestamps and SHA-256 hashes; geometry/selection QA; matching tables; threshold sensitivity; and projected GIS layers. Synthetic tests cover split buildings, duplicate shapes, invalid polygons, leading zeroes, empty inputs and grid-edge allocation. The local GIS package contains a GeoPackage and a relative-path QGIS project. Web geometries are lightly simplified for display only.</p>
 <h3>Sources, dates and licences</h3>${Object.entries(catalog.sources).map(([k,v])=>`<p><strong>${v.label}</strong><br>${v.date_note}<br>${v.credit} · ${v.licence}<br><a href="${v.url}" target="_blank" rel="noopener">Source documentation ↗</a></p>`).join('')}
 <p>Official administrative boundaries: Geobasis NRW DVG1; Data licence Germany — Zero 2.0. Boundary dates are shown beside the municipality key. Analysis built ${catalog.built_at_utc.slice(0,10)} UTC. Retrieval is not a uniform observation date.</p><p>Mixed derived data retains source obligations, including ODbL attribution. This local version has not been published. No confidential project inputs are used.</p>`;
 $('methodContent').innerHTML=html;$('methodDialog').showModal();
}
async function main(){
 catalog=await read('catalog.json');initMap();await loadWindow();
 $('city').addEventListener('change',e=>{city=e.target.value;loadWindow();});
 $('source').addEventListener('change',e=>{source=e.target.value;loadWindow(false);});
 document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw();}));
 $('filter').addEventListener('change',draw);$('referenceToggle').addEventListener('change',draw);$('fit').addEventListener('click',fitWindow);
 $('closeSelection').addEventListener('click',()=>{$('selection').hidden=true;if(selectionHighlight){map.removeLayer(selectionHighlight);selectionHighlight=null;}});
 for(const id of ['methodOpen','methodOpen2','sourceDetails','countInfo'])$(id).addEventListener('click',method);
 document.querySelector('.dialog-close').addEventListener('click',()=>$('methodDialog').close());
 $('methodDialog').addEventListener('click',e=>{if(e.target===$('methodDialog'))$('methodDialog').close();});
 window.explorerReady=true;
}
main().catch(e=>{text('loadMessage',e.message);console.error(e);});
