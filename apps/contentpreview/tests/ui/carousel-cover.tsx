// In-memory fixture only. No production media, API requests, or saved workspace.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Inspector } from '../../components/ysabel-workspace';
import { replaceCarouselCover } from '../../lib/carousel-cover';
import '@fontsource/geist/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '../../styles.css';
const seed = ['interior','food','cocktail','food'].map((name,index)=>({
  id:`demo-${index}`, name:`${name} ${index}`, fileName:`${name}.png`, mimeType:'image/png', fileSize:500000,
  url:`/contentpreview-app/seed-${name}.png`, format:index?'Photo':'Carousel', category:'Italian', status:'Published',
  plannedDate:'2026-11-15' as string | null, caption:'Dinner with friends.', notes:'Preserve every slide.', slides:index?[]:['demo-1','demo-2'],
  cropZoom:100,cropX:50,cropY:50,palette:'',archived:false,
}));
function Fixture() {
  const [assets,setAssets]=useState(seed), [selected,setSelected]=useState<string|null>('demo-0');
  const [postId,setPostId]=useState('demo-0');
  const post=assets.find(item=>item.id===postId)!;
  const replace=(source:typeof post,sourceId?:string)=>{
    const next=replaceCarouselCover(post,{...source,id:`copy-${Date.now()}`},sourceId);
    setAssets(value=>[next,...value]);setPostId(next.id);setSelected(next.id);
  };
  return <main style={{padding:32}}><h1>Published carousel cover check</h1><button onClick={()=>setSelected(postId)}>Open post editor</button>
    <output aria-label="Post data">{JSON.stringify(post)}</output>
    <Inspector asset={assets.find(item=>item.id===selected)||null} assets={assets} onClose={()=>setSelected(null)} onChange={asset=>setAssets(value=>value.map(item=>item.id===asset.id?asset:item))} onRemove={()=>{}} onDuplicate={()=>{}} onAddSlides={()=>{}}
      onReplace={()=>replace(seed[3])} onChooseCover={async id=>{replace(assets.find(item=>item.id===id)!,id);}} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
