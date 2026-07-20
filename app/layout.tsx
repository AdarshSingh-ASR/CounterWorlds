import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans=Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono=Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});

export async function generateMetadata():Promise<Metadata>{
  const requestHeaders=await headers();const host=requestHeaders.get("x-forwarded-host")??requestHeaders.get("host")??"localhost:3000";const protocol=requestHeaders.get("x-forwarded-proto")??(host.startsWith("localhost")?"http":"https");const base=new URL(`${protocol}://${host}`);const socialImage=new URL("/og.png",base).toString();
  return {metadataBase:base,title:{default:"CounterWorlds — Turn Wrong Answers Into Playable Universes",template:"%s · CounterWorlds"},description:"A live classroom observatory where real AI generation turns student misconceptions into playable counterfactual experiments.",openGraph:{title:"CounterWorlds — Build the universe where the wrong answer is right",description:"Students predict, experiment, and revise. Teachers see beliefs change—not just scores.",type:"website",images:[{url:socialImage,width:1200,height:630,alt:"CounterWorlds — Turn wrong answers into playable universes"}]},twitter:{card:"summary_large_image",title:"CounterWorlds",description:"Where misconceptions become experiments.",images:[socialImage]}};
}

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>}
