export type PlaybackStatus = 'paused'|'loading'|'playing'|'blocked'|'video'|'error';
export type PlaybackState = {index:number;status:PlaybackStatus;position:number;duration:number;volume:number;wanted:boolean};
type Track = {src:string};

// One controller owns one audio element for the lifetime of the shared layout.
export class MusicPlayback {
  state:PlaybackState;
  private request=0;
  private suspended=false;
  private disposed=false;
  private listeners:Array<[string,EventListener]>=[];
  constructor(private audio:HTMLAudioElement,private tracks:Track[],private notify:(state:PlaybackState)=>void,volume=.3,private random= Math.random){
    this.state={index:-1,status:'paused',position:0,duration:0,volume,wanted:false};
    audio.volume=volume;
    this.listen('playing',()=>{if(!this.state.wanted||this.suspended){audio.pause();return;}this.emit({status:'playing'});});
    this.listen('pause',()=>{if(!this.suspended&&this.state.status==='playing')this.emit({status:'paused'});});
    this.listen('waiting',()=>{if(this.state.wanted&&!this.suspended)this.emit({status:'loading'});});
    this.listen('timeupdate',()=>this.emit({position:audio.currentTime}));
    this.listen('durationchange',()=>this.emit({duration:Number.isFinite(audio.duration)?audio.duration:0}));
    this.listen('error',()=>{this.request++;this.emit({status:'error'});});
    this.listen('ended',()=>{if(this.state.wanted)this.next();});
  }
  private listen(name:string,fn:()=>void){this.audio.addEventListener(name,fn);this.listeners.push([name,fn]);}
  private emit(change:Partial<PlaybackState>){if(this.disposed)return;this.state={...this.state,...change};this.notify(this.state);}
  private attempt(){
    if(this.disposed||!this.state.wanted||this.suspended||this.state.index<0)return;
    const request=++this.request;
    this.emit({status:'loading'});
    void this.audio.play().catch((error:unknown)=>{
      if(this.disposed||request!==this.request||!this.state.wanted||this.suspended)return;
      const name=(error as {name?:string})?.name;
      if(name==='AbortError')return;
      this.emit({status:name==='NotAllowedError'?'blocked':'error'});
    });
  }
  start(wanted=true){this.select(Math.floor(this.random()*this.tracks.length),wanted);}
  select(index:number,wanted=true){
    if(!this.tracks[index]||this.disposed)return;
    this.request++;this.audio.pause();
    this.emit({index,wanted,position:0,duration:0,status:this.suspended&&wanted?'video':'paused'});
    this.audio.src=this.tracks[index].src;this.audio.load();this.attempt();
  }
  toggle(){if(this.state.wanted&&!['blocked','error'].includes(this.state.status))this.pause();else this.play();}
  play(){this.emit({wanted:true,status:this.suspended?'video':this.state.status});this.attempt();}
  pause(){this.request++;this.emit({wanted:false,status:'paused'});this.audio.pause();}
  activate(){if(this.state.status==='blocked')this.attempt();}
  next(){
    const n=this.tracks.length;if(!n)return;
    const index=n===1?0:(this.state.index+1+Math.floor(this.random()*(n-1)))%n;
    this.select(index);
  }
  previous(){if(this.tracks.length)this.select((this.state.index+this.tracks.length-1)%this.tracks.length);}
  setVolume(value:number){const volume=Math.max(0,Math.min(1,value));this.audio.volume=volume;this.emit({volume});}
  seek(value:number){if(!Number.isFinite(value)||!this.state.duration)return;this.audio.currentTime=Math.max(0,Math.min(value,this.state.duration));this.emit({position:this.audio.currentTime});}
  suspendForVideo(suspended:boolean){
    if(this.suspended===suspended)return;this.suspended=suspended;this.request++;
    if(suspended){this.audio.pause();if(this.state.wanted)this.emit({status:'video'});}
    else if(this.state.wanted)this.attempt();
  }
  destroy(){this.disposed=true;this.request++;for(const[name,fn]of this.listeners)this.audio.removeEventListener(name,fn);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
}
