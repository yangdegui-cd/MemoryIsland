export type MusicTrack = {id:string;title:string;artist:string;src:string;source:string};

export const musicPlaylist:MusicTrack[] = [
  {id:'midnight',title:'Midnight',artist:'NIGHTSYN',src:'/music/midnight.m4a',source:'https://www.youtube.com/watch?v=OECt9mopaa0'},
  {id:'autumn',title:'Autumn · 秋',artist:'LJY',src:'/music/autumn.m4a',source:'https://www.youtube.com/watch?v=xIMrnLIanO0'},
  {id:'idea',title:'IDEA · 理想',artist:'TAEMIN 泰民',src:'/music/idea.m4a',source:'https://www.youtube.com/watch?v=KUvOQlkLNhE'},
  {id:'lemon',title:'Lemon',artist:'米津玄师',src:'/music/lemon.m4a',source:'https://www.youtube.com/watch?v=SX_ViT4Ra7k'},
  {id:'colors',title:'Colors',artist:'Limi',src:'/music/colors.m4a',source:'https://www.youtube.com/watch?v=g7dGOqDWQS4'},
  {id:'boku-ga',title:'僕が死のうと思ったのは',artist:'中岛美嘉',src:'/music/boku-ga.m4a',source:'https://www.bilibili.com/video/BV1Eb411W7ky?p=2'},
  {id:'my-all',title:'MY ALL',artist:'滨崎步',src:'/music/my-all.m4a',source:'https://www.bilibili.com/video/BV12M4y1W7vH/'},
  {id:'homesick',title:'homesick',artist:'wave to earth',src:'/music/homesick.m4a',source:'https://www.youtube.com/watch?v=RxiTWxP9Xf4'},
  {id:'before-spring',title:'Before spring ends · 在春天消失之前',artist:'王OK',src:'/music/before-spring.m4a',source:'https://www.youtube.com/watch?v=y0rANZHhrRY'},
];

export const playableMusic = musicPlaylist.filter(track=>track.src);
