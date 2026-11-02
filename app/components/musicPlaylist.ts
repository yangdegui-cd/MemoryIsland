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
  {id:'no-hands',title:'No Hands',artist:'Waka Flocka Flame feat. Roscoe Dash & Wale',src:'/music/no-hands.m4a',source:'https://www.youtube.com/watch?v=DeX3Tss3AqE'},
  {id:'heaven',title:'天堂 · Heaven',artist:'腾格尔 · 歌手2018现场版',src:'/music/heaven.m4a',source:'https://www.youtube.com/watch?v=H2mvc0miJ-w'},
  {id:'chicago',title:'Chicago',artist:'Michael Jackson',src:'/music/chicago.m4a',source:'https://www.youtube.com/watch?v=Y_8mUx4VOmo'},
  {id:'sweet-dreams',title:'Sweet Dreams',artist:'THEN · Cinematic Techno',src:'/music/sweet-dreams.m4a',source:'https://www.youtube.com/watch?v=0QAKKYJJ2l0'},
  {id:'dissociation',title:'Dissociation',artist:'Aaryan Shah',src:'/music/dissociation.m4a',source:'https://www.youtube.com/watch?v=e4IHnhzYezE'},
  {id:'you-rock-my-world',title:'You Rock My World',artist:'Michael Jackson',src:'/music/you-rock-my-world.m4a',source:'https://www.youtube.com/watch?v=iCuyFxSe6Mg'},
  {id:'norwegian-forest',title:'挪威的森林 · Norwegian Forest',artist:'伍佰 Wu Bai & China Blue',src:'/music/norwegian-forest.m4a',source:'https://www.youtube.com/watch?v=gPpZJlE0Ca8'},
  {id:'dance-monkey-mix',title:'Dance Monkey · 合辑 / Mix',artist:'Jolie Lyrics',src:'/music/dance-monkey-mix.m4a',source:'https://www.youtube.com/watch?v=CKg4WARv_hA'},
  {id:'wake-live',title:'Wake · Live from Summercamp',artist:'Hillsong Young & Free',src:'/music/wake-live.m4a',source:'https://www.youtube.com/watch?v=e33zCUm1ZnY'},
  {id:'try-live',title:'Try · Live from Los Angeles',artist:'P!NK',src:'/music/try-live.m4a',source:'https://www.youtube.com/watch?v=ivPEKaBHjYA'},
  {id:'far-away-from-home',title:'Far Away From Home',artist:'Groove Coverage',src:'/music/far-away-from-home.m4a',source:'https://www.youtube.com/watch?v=y8ihgjjVo48'},
  {id:'dancing-with-your-ghost-acoustic',title:'Dancing With Your Ghost · Acoustic',artist:'Sasha Alex Sloan',src:'/music/dancing-with-your-ghost-acoustic.m4a',source:'https://www.youtube.com/watch?v=a5RQ0z29XoU'},
];

export const playableMusic = musicPlaylist.filter(track=>track.src);
