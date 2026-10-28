import Papa from 'papaparse';
export function stripPreamble(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  const index=lines.findIndex(l=>/^Timestamp\s*,/i.test(l));
  return index>=0?lines.slice(index).join('\n'):text.replace(/^\uFEFF/,'');
}
export async function inspectFile(file,encoding='UTF-8'){
  const text=new TextDecoder(encoding).decode(await file.slice(0,256*1024).arrayBuffer());
  const clean=stripPreamble(text),result=Papa.parse(clean,{header:true,skipEmptyLines:'greedy',preview:20});
  const fields=result.meta.fields;
  if(!fields?.length||fields.length<2)throw new Error('CSVのヘッダーを認識できません。文字コードと区切りを確認してください。');
  if(new Set(fields).size!==fields.length||result.meta.renamedHeaders)throw new Error('重複する列名があります。列名を一意にしてください。');
  return {fields,rows:result.data,cygnus:/Cygnus version:/.test(text),fs:Number(text.match(/sampling rate:\s*(\d+)/i)?.[1]||1000)};
}
