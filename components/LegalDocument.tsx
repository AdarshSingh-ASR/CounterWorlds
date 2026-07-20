import Link from "next/link";

function Mark(){return <span className="signal-mark" aria-hidden="true"><i/><i/><i/></span>}

export function LegalDocument({kind}:{kind:"privacy"|"terms"|"student"|"acceptable"}){
  const contact=process.env.LEGAL_CONTACT_EMAIL??"adarshsingh8a33@gmail.com";const operator=process.env.LEGAL_OPERATOR_NAME??"Adarsh Singh";
  const content={
    privacy:{title:"Privacy notice",intro:"How CounterWorlds handles teacher accounts, anonymous classroom participation, and generated learning evidence.",sections:[
      ["Information we collect","Teachers authenticate through Google. We store the resulting account identifier, email, display name, school workspace, settings, classroom content, and security audit events. Students do not create accounts; we store a chosen nickname, classroom explanation, prediction, and revision."],
      ["Why we use it","We use this information to operate classrooms, generate the requested experiments, prevent abuse, preserve teacher ownership, and show evidence of conceptual change."],
      ["AI processing","The teacher's question, canonical model, and anonymous student explanations are sent to the selected AI provider: Vertex AI Gemini by default, or OpenAI only when a teacher selects an encrypted bring-your-own key. Students should not submit personal information."],
      ["Retention and deletion","Archived classrooms are retained for 90 days and then permanently deleted with their generated artifacts. A teacher can permanently delete an owned classroom earlier."],
      ["Security and access","Teacher access uses Google and secure server sessions. Student access uses a random classroom-scoped token stored only in that browser. Teacher-provided API keys are encrypted with authenticated encryption and are never returned after saving."],
      ["Contact",`CounterWorlds is operated by ${operator}. Contact ${contact} for privacy, access, correction, or deletion requests.`],
    ]},
    terms:{title:"Pilot terms",intro:"Terms for the CounterWorlds global school pilot.",sections:[
      ["Pilot service","CounterWorlds is an experimental educational service, not a grading, examination, student-record, or emergency system. Generated experiments must be reviewed by the teacher before classroom use."],
      ["Teacher responsibility","Teachers must be authorized by their school or learning organization, use the service only with learners aged 13 or older, provide an appropriate student notice, avoid requesting personal information, and supply an accurate canonical model."],
      ["Accounts and workspaces","Teachers are responsible for their Google account and workspace membership. Owners and admins must remove access when a colleague leaves. Students may not receive teacher access."],
      ["AI and scientific accuracy","AI output can be incomplete or incorrect. Teachers must verify the generated law, controls, evidence, and reveal. CounterWorlds rejects artifacts that fail technical validation, but technical validation is not a guarantee of scientific correctness."],
      ["Availability","The pilot is provided as available and may change, pause, or end. Do not rely on it as the only copy of information required by a school."],
      ["Contact",`Questions about these terms may be sent to ${contact}. The service operator is ${operator}.`],
    ]},
    student:{title:"Student privacy",intro:"A short notice for learners joining a CounterWorlds classroom.",sections:[
      ["You do not need an account","Your teacher gives you a six-character code. Choose a classroom-safe nickname that is not your real name, email, phone number, or social handle."],
      ["What you share","CounterWorlds stores your nickname, explanation, prediction, evidence note, and revised explanation inside this classroom. Your teacher can see these entries. Other students cannot see your private explanation through the app."],
      ["How AI is used","Your nickname and explanation may be sent to an AI model as untrusted classroom data so it can group beliefs and build the experiment. Do not include personal or sensitive information."],
      ["How long it remains","When the teacher archives the classroom, its data is scheduled for permanent deletion after 90 days. The teacher may delete it sooner."],
      ["Need help?",`Ask your teacher first. Privacy questions can also be sent to ${contact}. CounterWorlds is for learners aged 13 or older.`],
    ]},
    acceptable:{title:"Acceptable use",intro:"Safety boundaries for teachers, workspace administrators, and students.",sections:[
      ["Use CounterWorlds for learning","Use the service to explore legitimate grade 9–12 scientific and mathematical mental models. Do not use it for grading, discipline, admissions, surveillance, profiling, or decisions about a learner."],
      ["Protect students","Do not request or submit real names, contact details, health information, precise locations, credentials, or other sensitive information. Do not attempt to re-identify anonymous learners."],
      ["Do not attack the service","Do not probe other classrooms, evade rate limits, upload malicious prompts, extract secrets, interfere with generated-world isolation, or access accounts without authorization."],
      ["Review generated content","Teachers must check every generated world before launch. Report unsafe, inaccurate, discriminatory, or inappropriate content and do not expose it to students."],
      ["Enforcement",`CounterWorlds may suspend accounts or workspaces that create safety or security risk. Report concerns to ${contact}.`],
    ]},
  }[kind];
  return <main className="portal-page"><header className="portal-header"><Link href="/" className="signal-logo"><Mark/><span>COUNTERWORLDS</span></Link><nav><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav></header><article className="portal-content legal-page"><span className="portal-eyebrow">SCHOOL PILOT · VERSION 2026-07-20</span><h1>{content.title}</h1><p>{content.intro}</p>{content.sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}<p style={{marginTop:50}}>These pilot documents are practical product notices and should be reviewed by qualified counsel before broad institutional adoption.</p></article></main>;
}
