import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
process.env.FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9098";
const response=await fetch("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"admin@t2t.test",password:"DemoOnly-123456!",returnSecureToken:true})});
const user=await response.json();if(!user.localId)throw new Error("Demo Auth seed failed");
await getAdminAuth(initializeAdminApp({projectId:"demo-t2t-security"},"ui-test")).setCustomUserClaims(user.localId,{admin:true});
const env=await initializeTestEnvironment({projectId:"demo-t2t-security",firestore:{host:"127.0.0.1",port:8085}});
await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,"users",user.localId),{id:user.localId,email:"admin@t2t.test",companyName:"Yerel Test Yöneticisi",role:"admin",projectId:"DEMO",assignedProjects:["DEMO"],status:"active"});
  await setDoc(doc(db,"users/approver"),{id:"approver",email:"approver@t2t.test",companyName:"Yerel Onaylayan",role:"admin",projectId:"DEMO",assignedProjects:["DEMO"],status:"active"});
  await setDoc(doc(db,"projects/DEMO"),{id:"DEMO",name:"Yerel Test Projesi",description:"Yalnızca emülatör verisi",status:"active"});
});
await env.cleanup();console.log("Yerel demo hesap ve proje hazır.");
