export const categories=[
{id:'daily',title:'日常 · Daily life',icon:'☕',options:['工作','吃喝','作息','小习惯'],english:['Work','Food & drinks','Routine','Little habits']},
{id:'favorites',title:'喜好 · Favorites',icon:'♡',options:['音乐','游戏','穿搭','旅行'],english:['Music','Games','Style','Travel']},
{id:'experiences',title:'经历 · Experiences',icon:'✦',options:['童年','趣事','尴尬时刻','难忘回忆','恋爱经历','性经历'],english:['Childhood','Funny moments','Awkward moments','Memorable moments','Dating history','Sexual experience']},
{id:'personality',title:'性格 · Personality',icon:'✳',options:['优点','缺点','害怕的事','反差'],english:['Strengths','Weaknesses','Fears','Contrasts']},
{id:'us',title:'彼此 · Us',icon:'☘',options:['第一印象','共同回忆','好奇的地方','想一起做的事'],english:['First impressions','Shared memories','Curiosities','Things to do together']},
{id:'attraction',title:'心动 · Attraction',icon:'♡',options:['理想型','心动瞬间','表达好感','相处边界'],english:['Ideal type','Attraction moments','Expressing interest','Boundaries']}
];
export const topics=categories.flatMap(c=>c.options.map((label,i)=>({label,english:c.english[i],category:c.title})));
