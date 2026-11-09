const observationTypes=new Set(["strength","weakness","promotion","customer_experience","strategy","opportunity","risk","other"]);
const dateIsReal=value=>{if(typeof value!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return false;const d=new Date(value+"T00:00:00Z");return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;};
function safeHttpUrl(value){if(value==null||value==="")return true;try{return ["http:","https:"].includes(new URL(value).protocol);}catch{return false;}}
/** Validate commercial evidence before it enters persistence. */
export function validateMarketObservation(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return "El cuerpo debe ser un objeto.";
 const allowed=["competitorId","type","title","content","sourceName","sourceUrl","observedOn","confidence"];
 if(Object.keys(input).some(key=>!allowed.includes(key)))return "Hay campos no permitidos.";
 if(input.competitorId!=null&&typeof input.competitorId!=="string")return "El competidor no es válido.";
 if(!observationTypes.has(input.type))return "El tipo de observación no es válido.";
 if(typeof input.title!=="string"||!input.title.trim()||input.title.trim().length>180)return "El título es obligatorio y admite hasta 180 caracteres.";
 if(typeof input.content!=="string"||!input.content.trim()||input.content.trim().length>3000)return "El contenido es obligatorio y admite hasta 3000 caracteres.";
 if(!dateIsReal(input.observedOn))return "La fecha debe ser una fecha real en formato AAAA-MM-DD.";
 if(input.confidence!==undefined&&!["low","medium","high"].includes(input.confidence))return "El nivel de confianza no es válido.";
 if(input.sourceName!=null&&input.sourceName!==""&&(typeof input.sourceName!=="string"||!input.sourceName.trim()||input.sourceName.trim().length>180))return "El campo sourceName no es válido.";
 if(!safeHttpUrl(input.sourceUrl))return "El campo sourceUrl debe ser una URL válida y usar http o https.";
 input.title=input.title.trim();input.content=input.content.trim();if(input.sourceName)input.sourceName=input.sourceName.trim();
 return null;
}
