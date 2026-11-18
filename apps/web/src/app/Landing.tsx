"use client";

import { useState } from "react";

import styles from "./page.module.css";

const REPO = "https://github.com/M67X9/Khisha";

type Copy = {
  dir: "ltr" | "rtl";
  switchTo: string;
  tagline: string;
  heroBody: string;
  repo: string;
  problemTitle: string;
  problem: string;
  stepsTitle: string;
  steps: { title: string; body: string }[];
  featuresTitle: string;
  features: { title: string; body: string }[];
  trustTitle: string;
  trust: string[];
  stackTitle: string;
  status: string;
  askQ: string;
  askA: string;
  askSource: string;
};

const COPY: Record<"en" | "ar", Copy> = {
  en: {
    dir: "ltr",
    switchTo: "العربية",
    tagline: "Save it now, find it later.",
    heroBody: "Khisha is an iPhone-first personal AI memory assistant. Save a receipt, a warranty or any document in seconds, then search it or just ask a question and get the answer with its source.",
    repo: "View the code on GitHub",
    problemTitle: "The problem",
    problem: "Important details live in screenshots, photos and PDFs that nobody can find later: the warranty end date, what you paid, which invoice it was. Khisha reads the file for you, keeps the facts that matter, and never invents a number.",
    stepsTitle: "How it works",
    steps: [
      { title: "Add", body: "Pick a screenshot, photo or PDF. It is uploaded to private storage." },
      { title: "Review", body: "The AI reads it into a draft. You confirm every important amount and date before anything is saved." },
      { title: "Find", body: "Search in Arabic or English, or ask a question and get an answer with tappable sources." },
    ],
    featuresTitle: "What is inside",
    features: [
      { title: "AI reading of files", body: "Images and PDFs become a titled, categorised memory with the amount, dates and merchant extracted." },
      { title: "Confirm before saving", body: "Every critical figure is shown next to your file and needs your explicit confirmation. Unsure values are flagged." },
      { title: "Smart search", body: "Works across Arabic and English, forgives typos and alternate Arabic spellings, filters by category and date." },
      { title: "Ask AI with sources", body: "Answers come only from your own memories, clearly label general knowledge, and say so when something is not found." },
      { title: "Arabic and English, truly RTL", body: "Full right-to-left layout, Arabic typography, and Western digits in both languages." },
      { title: "Made personal", body: "Your name, a personal greeting and a colour tone that keeps the same visual identity." },
      { title: "Private by design", body: "Row level security on every table, private file storage, and temporary uploads deleted after an hour unless you keep them." },
      { title: "Resilient", body: "Retries on AI failures, a scheduled cleanup job and clear messages when something expires." },
    ],
    trustTitle: "Built so you can trust it",
    trust: ["Nothing is marked verified until you confirm it.", "Your files and answers stay yours: each person only ever sees their own rows.", "All AI and server logic runs on the server, never inside the app."],
    stackTitle: "Built with",
    status: "Khisha is a capstone project in private testing. The mobile app runs in Expo Go.",
    askQ: "How much was my Carrefour receipt?",
    askA: "Your Carrefour receipt was 18.450 KWD, dated 12 Nov 2026.",
    askSource: "Source: Carrefour groceries",
  },
  ar: {
    dir: "rtl",
    switchTo: "English",
    tagline: "خِشّه الحين، تلقاه بعدين",
    heroBody: "خِشّه مساعد ذكي لذاكرتك الشخصية، مصمم للآيفون أولاً. احفظ فاتورة أو ضمان أو أي مستند في ثوانٍ، ثم ابحث عنه أو اسأل سؤالاً واحصل على الإجابة مع مصدرها.",
    repo: "شاهد الكود على GitHub",
    problemTitle: "المشكلة",
    problem: "التفاصيل المهمة تضيع بين لقطات الشاشة والصور وملفات PDF: تاريخ انتهاء الضمان، كم دفعت، أي فاتورة كانت. خِشّه يقرأ الملف عنك، ويحتفظ بالمعلومات المهمة، ولا يخترع رقماً أبداً.",
    stepsTitle: "كيف يعمل",
    steps: [
      { title: "أضف", body: "اختر لقطة شاشة أو صورة أو ملف PDF، ويُرفع إلى تخزين خاص." },
      { title: "راجع", body: "يقرأ الذكاء الاصطناعي الملف إلى مسودة، وتؤكد أنت كل مبلغ وتاريخ مهم قبل الحفظ." },
      { title: "اعثر", body: "ابحث بالعربية أو الإنجليزية، أو اسأل سؤالاً واحصل على إجابة مع مصادر يمكن فتحها." },
    ],
    featuresTitle: "ما بداخل التطبيق",
    features: [
      { title: "قراءة الملفات بالذكاء الاصطناعي", body: "تتحول الصور وملفات PDF إلى ذكرى بعنوان وتصنيف، مع استخراج المبلغ والتواريخ والمتجر." },
      { title: "تأكيد قبل الحفظ", body: "يظهر كل رقم مهم بجانب ملفك ويحتاج إلى تأكيدك الصريح، وتُوسَم القيم غير المؤكدة." },
      { title: "بحث ذكي", body: "يعمل بالعربية والإنجليزية، ويتسامح مع الأخطاء الإملائية واختلاف كتابة الحروف، ويصفّي بالتصنيف والتاريخ." },
      { title: "اسأل الذكاء الاصطناعي مع المصادر", body: "الإجابات من ذكرياتك فقط، مع توضيح المعلومات العامة، وإخبارك عندما لا يوجد الجواب." },
      { title: "عربي وإنجليزي بتخطيط حقيقي من اليمين لليسار", body: "تخطيط كامل من اليمين لليسار، وخط عربي مناسب، وأرقام غربية في اللغتين." },
      { title: "تجربة شخصية", body: "اسمك، وترحيب خاص، ودرجة لون تحافظ على الهوية البصرية نفسها." },
      { title: "الخصوصية أولاً", body: "حماية على مستوى الصفوف في كل جدول، وتخزين خاص للملفات، وحذف الملفات المؤقتة بعد ساعة ما لم تحتفظ بها." },
      { title: "مرونة عند الأعطال", body: "إعادة محاولة عند فشل الذكاء الاصطناعي، ومهمة تنظيف مجدولة، ورسائل واضحة عند انتهاء الصلاحية." },
    ],
    trustTitle: "مبني لتثق به",
    trust: ["لا شيء يُعتبر موثّقاً حتى تؤكده أنت.", "ملفاتك وإجاباتك لك وحدك: كل شخص يرى بياناته فقط.", "كل منطق الذكاء الاصطناعي والخادم يعمل على الخادم، وليس داخل التطبيق."],
    stackTitle: "مبني باستخدام",
    status: "خِشّه مشروع تخرج في مرحلة اختبار خاصة. يعمل تطبيق الجوال عبر Expo Go.",
    askQ: "كم كانت فاتورة كارفور؟",
    askA: "كانت فاتورة كارفور 18.450 د.ك بتاريخ 12 نوفمبر 2026.",
    askSource: "المصدر: Carrefour groceries",
  },
};

const STACK = ["Expo / React Native", "Supabase (Postgres, Auth, Storage, Edge Functions)", "OpenRouter AI models", "Next.js on Vercel", "TypeScript"];

export function Landing() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const c = COPY[lang];

  return (
    <div className={styles.page} dir={c.dir} lang={lang} data-lang={lang}>
      <header className={styles.top}>
        <span className={styles.logo}>
          <span lang="ar">خِشّه</span> Khisha
        </span>
        <button type="button" className={styles.switch} onClick={() => setLang(lang === "en" ? "ar" : "en")} lang={lang === "en" ? "ar" : "en"}>
          {c.switchTo}
        </button>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1>{c.tagline}</h1>
          <p>{c.heroBody}</p>
          <a className={styles.cta} href={REPO} target="_blank" rel="noreferrer">
            {c.repo}
          </a>
        </div>
        <div className={styles.phone} aria-hidden="true">
          <div className={styles.bubbleUser}>{c.askQ}</div>
          <div className={styles.bubbleBot}>
            {c.askA}
            <span className={styles.kind}>{lang === "en" ? "From your memories" : "من ذكرياتك"}</span>
          </div>
          <div className={styles.source}>{c.askSource}</div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{c.problemTitle}</h2>
        <p className={styles.lead}>{c.problem}</p>
      </section>

      <section className={styles.section}>
        <h2>{c.stepsTitle}</h2>
        <ol className={styles.steps}>
          {c.steps.map((s, i) => (
            <li key={s.title}>
              <span className={styles.num}>{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>{c.featuresTitle}</h2>
        <div className={styles.grid}>
          {c.features.map((f) => (
            <article key={f.title} className={styles.card}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>{c.trustTitle}</h2>
        <ul className={styles.trust}>
          {c.trust.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>{c.stackTitle}</h2>
        <div className={styles.chips}>
          {STACK.map((s) => (
            <span key={s} className={styles.chip}>
              {s}
            </span>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>{c.status}</p>
        <a href={REPO} target="_blank" rel="noreferrer">
          {REPO}
        </a>
      </footer>
    </div>
  );
}
