import { createSpec, costLinesFromSpec, NUTRIENTS } from '../../src/domain/productSpec';
import { createMatrix, allCriteria } from '../../src/domain/rfqMatrix';
import { canAdvance, dependencies, validateCompletion, type TaskRecord } from '../../src/domain/workflow';

export const PROJECT = 'DEMO-HIGH-PROTEIN-TORTILLA';
export const MARKER = 't2t-sample-tortilla-v1';
export function sampleRecords(ownerUid: string) {
  const records: {path: string; data: Record<string, any>}[] = [];
  const add = (path: string, data: Record<string, any>) => records.push({path, data: {...data, sampleProject: MARKER}});
  const manufacturers = [
    {id:'sample-northfield', name:'Northfield Sample Bakeworks Ltd.'},
    {id:'sample-aegean', name:'Aegean Sample Grain Foods Co.'},
    {id:'sample-cappadocia', name:'Cappadocia Sample Flatbread Inc.'},
  ];
  const at = (day: number, hour = 10) => new Date(Date.UTC(2026, 8, day, hour));
  add(`projects/${PROJECT}`, {id:PROJECT, name:'DEMO – High-Protein Tortilla (Sample Project)', description:'Fictional sample project for presentation purposes. All companies, approvals, documents and commercial values are simulated.', status:'active', ownerUid, visibility:'administrators', createdAt:at(1), packaging_config:{productVariant:'High-Protein Tortilla',singleWeight:0.4,packagingStyle:'Resealable food-grade PP pouch',innerBoxCount:0,masterCartonCount:12,palletCartonCount:72,cartonNetWeight:4.8,cartonGrossWeight:5.2,cartonDimensions:'52 x 30 x 20 cm',totalGrossWeight:9360}});
  manufacturers.forEach((m,i) => add(`projects/${PROJECT}/manufacturers/${m.id}`, { ...m, projectId:PROJECT, vaultDetails:{
    pricingCapacity:{exwPriceList:`sample_${m.id}_exw_price_list.pdf`,moq:`${12000+i*6000} packs per SKU`,monthlyCapacity:`${600000-i*100000} packs per month`},
    productionTransit:{productionFirstOrder:`${28+i*7} days after artwork approval`,productionRepeatOrder:`${14+i*7} days`,shipmentTransitTime:'8-10 business days to Germany'},
    storageShelfLife:{frozenProducts:'18 months at -18 C',ambientProducts:'9 months below 25 C in a dry place'},
    certifications:{coa:`sample_${m.id}_coa.pdf`,certificates:['BRC (simulated certificate)','Halal (simulated certificate)','Vegan (simulated certificate)']},
    palletContainerConfig:{boxDimensions:'52 x 30 x 20 cm; 12 x 400 g packs',palletConfig:'80 x 120 cm; 72 cartons per pallet',containerCapacity40HC:'25 pallets; 1800 cartons; 21600 packs'},
    nutritionalValues:{energy:'1108 kJ / 263 kcal',fat:'5.87 g',fatSaturated:'1.1 g',carbohydrates:'32 g',sugar:'2.4 g',protein:`${20-i} g`,fiber:'3.87 g',salt:'1.96 g'},
    variations:['Original high-protein tortilla','Whole-wheat high-protein tortilla'],marketingSamples:'Fictional 400 g pack: 8 tortillas x 50 g. Evaluation samples reviewed for flexibility, taste and seal integrity. All document names are placeholders; no certification is represented as genuine.',
    exportMarkets:[{name:'Germany',flag:'🇩🇪'},{name:'Netherlands',flag:'🇳🇱'},{name:'United Kingdom',flag:'🇬🇧'},{name:'United Arab Emirates',flag:'🇦🇪'},{name:'Saudi Arabia',flag:'🇸🇦'}],productClaims:['High protein','Source of fibre','Vegan','Halal'],
  }}));
  const spec = createSpec({projectId:PROJECT,manufacturerId:manufacturers[0].id,manufacturerName:manufacturers[0].name,productName:'High-Protein Tortilla (Sample)',preparedBy:'Alex Morgan (fictional)',createdBy:ownerUid});
  Object.assign(spec,{id:'sample-northfield-v1',lineageId:'sample-northfield-tortilla',status:'approved',createdAt:at(18),updatedAt:at(24,11),approvedAt:at(24,11),approvedBy:ownerUid});
  spec.general = {...spec.general,variant:'Original; 8 x 50 g / 400 g pack',markets:'Germany, Netherlands, United Kingdom, United Arab Emirates, Saudi Arabia',date:'2026-09-18'};
  spec.formulation = [['Wheat flour',38,0.65],['Water',24,0.01],['Pea protein isolate',20,3.2],['Wheat gluten',8,1.8],['Rapeseed oil',5,1.3],['Vegetable fibre',2,2.1],['Salt',2,0.18],['Baking powder',1,1.5]].map(([name,ratio],i) => ({id:`sample-ingredient-${i}`,name:String(name),ratio:Number(ratio),function:['Base flour','Hydration','Protein enrichment','Elasticity','Softness','Fibre enrichment','Seasoning','Leavening'][i],supplier:'Fictional ingredient supplier',allergen:i===0||i===3,allergenName:i===0||i===3?'Wheat (gluten)':'',halal:true,vegan:true,ratioSource:'manufacturer',note:'Simulated manufacturer formulation; not a production instruction'}));
  const values = [1108,263,5.87,1.1,32,2.4,3.87,20,1.96];
  spec.nutrition = Object.fromEntries(NUTRIENTS.map((key,i) => [key,{target:values[i],actual:values[i],tolerance:5}])) as typeof spec.nutrition;
  spec.physical = [{id:'unit-weight',key:'unitWeight',name:'',target:'50',unit:'g',tolerance:'+/- 2 g'},{id:'sample-diameter',key:'diameter',name:'',target:'200',unit:'mm',tolerance:'+/- 5 mm'}];
  spec.micro = [{id:'sample-micro',parameter:'Salmonella',limit:'Absent in 25 g',unit:'25 g',method:'Simulated ISO 6579-1 result'}];
  spec.allergens = {mayContain:'Soy; simulated cross-contact assessment'};
  spec.process = [{id:'sample-process',step:'Baking',parameter:'Validated time and temperature',control:'Simulated HACCP review completed'}];
  spec.packaging = [{id:'sample-pouch',level:'primary',material:'Resealable PP pouch',size:'400 g / 8 tortillas',quantity:1,perUnits:8},{id:'sample-carton',level:'secondary',material:'Corrugated export carton',size:'12 packs / 96 tortillas',quantity:1,perUnits:96},{id:'sample-pallet',level:'pallet',material:'EUR pallet',size:'72 cartons / 6912 tortillas',quantity:1,perUnits:6912},{id:'sample-label',level:'label',material:'Multilingual pack label',size:'1 label per pouch',quantity:1,perUnits:8}];
  spec.storage={frozen:'-18 C',ambient:'Below 25 C; dry storage',shelfLife:'9 months ambient / 18 months frozen',labelLanguage:'English, German, Dutch, Arabic',mandatoryInfo:'Sample only: ingredients, allergens, nutrition, net weight, lot code, best-before and storage instructions'};
  spec.openItems=[{id:'sample-resolved',question:'Confirm export carton compression performance',owner:'Alex Morgan (fictional)',status:'resolved'}];
  spec.goldenSample={code:'SAMPLE-NF-HPT-2026-001',location:'trade2turkey',date:'2026-09-24'};
  spec.approval={trade2turkey:{name:'Alex Morgan (fictional)',date:'2026-09-24'},manufacturer:{name:'Jamie Reed (fictional)',date:'2026-09-24'},signedDocName:'sample_northfield_spec_v1_signed.pdf',signedDocUrl:''};
  add(`projects/${PROJECT}/productSpecs/${spec.id}`,spec);
  const responses: Record<string,string[]> = {
    'Quality Control System':['HACCP; batch traceability; metal detection','HACCP; batch traceability','HACCP; periodic batch checks'],
    'Warranty Terms':['9-month ambient shelf life; sample quality agreement','9-month ambient shelf life','9-month shelf life; agreement under review'],
    'Audit':['Simulated desk audit closed','Simulated desk audit: minor finding closed','Simulated desk audit: improvement plan received'],
    'Import Taxes':['Indicative 0%; broker review required','Indicative 0%; broker review required','Indicative 0%; broker review required'],
    'Number of Employees':['180 (fictional)','140 (fictional)','95 (fictional)'],
    'Average Yearly Revenue':['18000000 EUR (fictional)','12500000 EUR (fictional)','8000000 EUR (fictional)'],
    'General Liability Insurance Coverage':['5000000 EUR (simulated)','3000000 EUR (simulated)','2000000 EUR (simulated)'],
    'Number of Factories':['2 (fictional)','1 (fictional)','1 (fictional)'],
    'Vertical Manufacturing':['In-house mixing, baking and packing','In-house baking and packing','In-house baking; external label printing'],
    'Retailer / Premium Private Label Experience':['6 years of simulated private-label supply','4 years of simulated private-label supply','2 years of simulated private-label supply'],
    'Other Product Groups':['Flatbreads and wraps','Whole-grain wraps','Ambient flatbreads'],
    'Key Differentiator 1':['High-protein formulation expertise','Whole-grain recipe portfolio','Flexible pilot batches'],
    'Key Differentiator 2':['Resealable pack capability','Multilingual label support','Short artwork turnaround'],
    'Key Differentiator 3':['EU pallet format','Stable ambient shelf life','Regional ingredient sourcing'],
    'Key Differentiator 4':['Export documentation support','In-house sample kitchen','Custom tortilla diameter'],
    'Key Differentiator 5':['Dedicated sample coordinator','Weekly production slots','Small-batch label options'],
    'Communication Speed':['Within 4 business hours','Within 1 business day','Within 2 business days'],
    'English Fluency':['Fluent technical and commercial team','Fluent commercial team','Working proficiency'],
    'Flexibility for Changes':['Two pilot iterations included','One pilot iteration included','Changes subject to pilot surcharge'],
    'Secondary Material':['Food-grade PP pouch','Food-grade PP pouch','Food-grade PP pouch'],
    'Component 1':['20 g protein / 100 g','19 g protein / 100 g','18 g protein / 100 g'],
    'Component 2':['8 x 50 g tortillas','8 x 50 g tortillas','8 x 50 g tortillas'],
    'Component 3':['12 packs / carton','12 packs / carton','12 packs / carton'],
    'Component 4':['72 cartons / pallet','72 cartons / pallet','72 cartons / pallet'],
    'Component 5':['9 months ambient shelf life','9 months ambient shelf life','9 months ambient shelf life'],
  };
  const matrix=createMatrix('Fictional RFQ: 400 g high-protein tortilla pack; EUR EXW; 21600 packs; all offers simulated.');
  matrix.manufacturers=manufacturers; matrix.isDemo=true; matrix.items[0].name='High-Protein Tortilla - 400 g pack';
  for(const c of allCriteria(matrix)) manufacturers.forEach((m,i)=>{
    c.scores[m.id]=5-i;
    c.values[m.id]=c.kind==='unitPrice'?`${[1.24,1.31,1.42][i]} EUR / pack`:c.kind==='leadTime'?`${28+i*7} days`:c.kind==='capacity'?`${600000-i*100000} packs / month`:c.kind==='years'?`${14-i*3} years (fictional)`:c.kind==='logistics'?`${0.12+i*0.02} EUR / pack`:({
      'Sample Quality':['Flexible texture; no tearing','Good texture; slight dryness','Acceptable texture; further work needed'],
      'Certificates':['BRC, Halal, Vegan (simulated)','BRC, Halal, Vegan (simulated)','BRC, Halal, Vegan (simulated)'],
      'Payment Terms':['30% deposit, 70% before dispatch','40% deposit, 60% before dispatch','50% deposit, 50% before dispatch'],
      'Primary Material':['Wheat flour and pea protein','Wheat flour and pea protein','Wheat flour and pea protein'],
    }[c.label]?.[i] ?? responses[c.label]?.[i] ?? ['Sample evidence reviewed; meets brief','Sample evidence reviewed; minor clarification','Sample evidence reviewed; improvement requested'][i]);
  });
  matrix.items[0].notes=Object.fromEntries(manufacturers.map(m=>[m.id,'Fictional offer for presentation; not a binding quotation.']));
  const costs=costLinesFromSpec(spec); costs.source.importedAt='2026-09-25T12:00:00.000Z';
  costs.lines.forEach((line,i)=>Object.assign(line,{id:`sample-cost-${i}`,unitPrice:[0.65,0.01,3.2,1.8,1.3,2.1,0.18,1.5,0.09,0.48,12,0.015][i],currency:'EUR',fxRate:1,wastePct:line.source==='formulation'?2:0,priceSource:'Fictional EXW cost estimate',priceDate:'2026-09-25'}));
  const notes=['Buyer brief and target markets agreed.','Product requirements and 400 g pack format confirmed.','Three fictional manufacturers screened.','RFQ package issued to all three manufacturers.','Shortlist reviewed for capacity and export readiness.','Indicative value chain reviewed in EUR.','Feasibility review completed; sourcing approved.','Supplier outreach and sample plan confirmed.','Introduction meetings completed with three suppliers.','Confidentiality and technical scope reviewed.','Initial samples received and evaluated.','Technical questions closed with suppliers.','RFQ matrix scored; Northfield leads the comparison.','Northfield selected as the high-potential manufacturer.','Specification v1.0 approved by both fictional parties.','Recipe cost lines imported from approved v1.0; EUR cost review approved.','Final specification and costing submitted; awaiting approval.','Factory audit and site visit preparation in progress.'];
  const steps=Object.keys(dependencies).filter(id=>id.startsWith('A.'));
  steps.forEach((id,i)=>{
    const approved=i<16, pending=id==='A.B.10', progress=id==='A.B.11', started=approved||pending||progress;
    const step:any={id:`sourcing-${id}`,projectId:PROJECT,workflow:'sourcing',section:'A',subsection:id.slice(0,3),stepId:id,workflowStatus:approved||pending?'completed':progress?'in_progress':'not_started',approval:approved?'approved':pending?'pending':'none',status:approved||pending?'Completed':progress?'In Progress':'Pending',assigneeUid:started?'sample-alex-morgan':'',assigneeName:started?'Alex Morgan (fictional)':'',approverUid:started?ownerUid:'',dueDate:started?`2026-09-${String(i+10).padStart(2,'0')}`:'',notes:started?`Sample project. Responsible: Alex Morgan (fictional). Reviewer: Jamie Reed (fictional). ${notes[i]}`:'',evidenceName:approved||pending?`sample_${id.replaceAll('.','_')}_review.pdf`:'',evidenceUrl:approved||pending?'https://example.invalid/sample-evidence':'',completedBy:approved||pending?'sample-alex-morgan':'',...(approved?{decidedBy:ownerUid}:{}),updatedAt:at(i+10,approved?15:pending?12:10),lastEventId:started?`sample-${id}-final`:''};
    if(id==='A.A.3')step.supplierLongList=manufacturers.map(m=>({...m,location:'Fictional production site',website:'',contact:'Sample contact',notes:'Fictional manufacturer'}));
    if(id==='A.A.5')step.supplierShortList=manufacturers.map(m=>({...m,location:'Fictional production site',website:'',contact:'Sample contact',notes:'Fictional manufacturer'}));
    if(id==='A.B.6')step.rfqComparisonMatrix=matrix;
    if(id==='A.B.7')Object.assign(step,{highPotentialManufacturerId:manufacturers[0].id,highPotentialManufacturerName:manufacturers[0].name});
    if(id==='A.B.8')Object.assign(step,{approvedSpecId:spec.id,specManufacturerId:manufacturers[0].id,specManufacturerName:manufacturers[0].name});
    if(id==='A.B.9')Object.assign(step,{recipeCostLines:costs.lines,recipeCostSource:costs.source});
    add(`sopSteps/${PROJECT}_sourcing-${id}`,step);
    if(started){
      add(`projects/${PROJECT}/events/sample-${id}-start`,{projectId:PROJECT,action:'workflow_save',entityId:id,statusKey:'in_progress',detail:`Sample history: Alex Morgan (fictional) started ${id}.`,actorUid:'sample-alex-morgan',at:at(i+10,9)});
      if(approved)add(`projects/${PROJECT}/events/sample-${id}-submit`,{projectId:PROJECT,action:'workflow_save',entityId:id,statusKey:'completed',detail:`Sample history: evidence submitted for ${id}.`,actorUid:'sample-alex-morgan',at:at(i+10,12)});
      add(`projects/${PROJECT}/events/sample-${id}-final`,{projectId:PROJECT,action:approved?'workflow_approve':'workflow_save',entityId:id,statusKey:approved?'approved':pending?'completed':'in_progress',detail:`Sample history: ${notes[i]} ${approved?'Reviewed by Jamie Reed (fictional).':'Prepared by Alex Morgan (fictional).'}`,actorUid:approved?ownerUid:'sample-alex-morgan',at:at(i+10,approved?15:pending?12:10)});
    }
  });
  validateSampleWorkflow(records);
  return {records,spec,matrix,costs};
}

// Validate the generated snapshot before any seed writes, including live imports.
export function validateSampleWorkflow(records: {path: string; data: Record<string, any>}[]) {
  const tasks: Record<string, TaskRecord> = Object.fromEntries(records.filter(r => r.path.startsWith('sopSteps/')).map(r => [r.data.stepId,r.data as TaskRecord]));
  for(const [id, task] of Object.entries(tasks)) {
    if(['in_progress','completed'].includes(task.workflowStatus)) {
      const blocked = canAdvance(id, tasks);
      if(blocked.length)throw new Error(`${id}: prerequisites must be approved: ${blocked.join(', ')}`);
    }
    if(task.workflowStatus==='completed')validateCompletion(task);
  }
}
