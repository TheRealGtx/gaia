import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const scenes=JSON.parse(readFileSync(path.join(root,'scenes.json'),'utf8'));
for(const dir of ['output','output/clips','output/audio','output/previews']) mkdirSync(path.join(root,dir),{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
for(const s of scenes){const out=path.join(root,'output/audio',s.id+'.aiff');if(!existsSync(out))run('/usr/bin/say',['-v','Samantha','-r','165','-o',out,s.voice]);}
function ts(sec){return new Date(sec*1000).toISOString().slice(11,23).replace('.',',');}
let subtitles=[],n=1;
scenes.forEach((s,i)=>{const sentences=s.voice.match(/[^.!?]+[.!?]+/g)||[s.voice];sentences.forEach((v,j)=>subtitles.push(`${n++}\n${ts(i*12+0.5+j*10.9/sentences.length)} --> ${ts(i*12+0.5+(j+1)*10.9/sentences.length)}\n${v.trim()}\n`));});
writeFileSync(path.join(root,'output/gaia-en.srt'),subtitles.join('\n'));
writeFileSync(path.join(root,'output/narration.txt'),scenes.map((s,i)=>`${ts(i*12)} | ${s.id}\n${s.voice}`).join('\n\n'));
writeFileSync(path.join(root,'output/timeline.csv'),'start_seconds,end_seconds,clip,replacement_slot\n'+scenes.map((s,i)=>`${i*12},${(i+1)*12},${s.id}.mp4,${s.slot||''}`).join('\n')+'\n');
run('/usr/bin/swiftc',['-module-cache-path','/tmp/gaia-video-swift-cache',path.join(root,'render.swift'),'-o',path.join(root,'output/render')]);
run(path.join(root,'output/render'),[root]);
