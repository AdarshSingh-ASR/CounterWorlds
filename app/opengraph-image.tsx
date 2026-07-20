import {ImageResponse} from "next/og";

export const alt="CounterWorlds — Turn wrong answers into playable universes";
export const size={width:1200,height:630};
export const contentType="image/png";

const particles=[[7,76,5],[14,63,3],[20,86,7],[27,72,4],[35,91,5],[43,80,3],[51,68,6],[57,88,4],[64,74,7],[72,94,4],[79,79,6],[86,66,3],[91,88,7],[96,73,4]];

export default function OpenGraphImage(){
  return new ImageResponse(
    <div style={{display:"flex",position:"relative",width:"100%",height:"100%",overflow:"hidden",background:"#050505",color:"#f7f7f2",fontFamily:"Arial, sans-serif",padding:"56px 64px",flexDirection:"column"}}>
      <div style={{display:"flex",position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(189,255,72,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(189,255,72,.045) 1px, transparent 1px)",backgroundSize:"42px 42px"}}/>
      <div style={{display:"flex",position:"absolute",left:"5%",right:"5%",bottom:"-16%",height:"48%",borderRadius:"50%",background:"radial-gradient(ellipse at center, rgba(171,255,44,.34) 0%, rgba(52,124,19,.16) 38%, rgba(0,0,0,0) 72%)",filter:"blur(8px)"}}/>
      {particles.map(([left,top,diameter],index)=><div key={index} style={{display:"flex",position:"absolute",left:`${left}%`,top:`${top}%`,width:diameter,height:diameter,borderRadius:"50%",background:index%3===0?"#e6ff9a":"#8ee52b",boxShadow:"0 0 18px rgba(177,255,60,.85)"}}/>)}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",position:"relative",width:34,height:34}}>
            <div style={{display:"flex",position:"absolute",width:23,height:23,left:0,top:0,border:"2px solid #d7ff65",transform:"rotate(45deg)"}}/>
            <div style={{display:"flex",position:"absolute",width:15,height:15,right:0,bottom:0,background:"#b8ff3d",transform:"rotate(45deg)"}}/>
          </div>
          <div style={{display:"flex",fontSize:24,letterSpacing:".18em",fontWeight:600}}>COUNTERWORLDS</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,border:"1px solid rgba(217,255,121,.45)",borderRadius:999,padding:"10px 17px",fontSize:14,letterSpacing:".12em",color:"#dfff8b"}}>
          <span style={{display:"flex",width:8,height:8,borderRadius:"50%",background:"#b8ff3d",boxShadow:"0 0 12px #b8ff3d"}}/>LIVE CLASSROOM LAB
        </div>
      </div>
      <div style={{display:"flex",zIndex:1,flexDirection:"column",marginTop:92,maxWidth:1030}}>
        <div style={{display:"flex",fontSize:18,letterSpacing:".22em",color:"#a7bd7b",marginBottom:24}}>MAKE BELIEFS TESTABLE</div>
        <div style={{display:"flex",fontSize:76,lineHeight:1.02,fontWeight:300,letterSpacing:"-.045em",flexWrap:"wrap"}}>Every wrong answer<br/>opens a new universe.</div>
        <div style={{display:"flex",marginTop:28,fontSize:22,lineHeight:1.45,color:"#a5a5a0",maxWidth:760}}>Students predict. Worlds collide. Evidence changes minds.</div>
      </div>
      <div style={{display:"flex",position:"absolute",zIndex:1,left:64,right:64,bottom:42,alignItems:"center",justifyContent:"space-between",fontSize:14,color:"#73805c",letterSpacing:".1em"}}>
        <span>AI-GENERATED COUNTERFACTUAL EXPERIMENTS</span><span style={{color:"#cfff67"}}>counter-worlds-uo4l.vercel.app →</span>
      </div>
    </div>,size,
  );
}
