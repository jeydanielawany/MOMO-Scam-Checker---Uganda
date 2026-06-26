import React, { useState, useMemo } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Search, 
  Send, 
  PhoneCall, 
  Lock, 
  CheckCircle2, 
  Plus, 
  Info, 
  BookOpen, 
  AlertCircle,
  HelpCircle,
  User,
  Building,
  ArrowRight,
  Sparkles,
  Copy,
  Share2,
  QrCode
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { 
  cleanPhoneNumber, 
  getTelecomOperator, 
  SCAM_DATABASE 
} from "./scamDatabase";
import { PhoneRecord, ScamStatus, TelecomOperator, UserReport } from "./types";
import { 
  extractScamDetails, 
  detectSimilarScam 
} from "./services/geminiService";

const momoShieldLogo = "/src/assets/images/momo_shield_logo_1782483009931.jpg";

export default function App() {
  // State for searching
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PhoneRecord | null>(null);
  const [searchedNumber, setSearchedNumber] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Helper to construct pre-filled WhatsApp share url
  const getWhatsAppShareUrl = (number: string, status: string, reason: string, operator?: string, scamType?: string) => {
    const emoji = status === "SCAM" ? "🚨 SCAM ALERT" : status === "WARNING" ? "⚠️ SUSPICIOUS WARNING" : "✅ SAFE";
    const appUrl = window.location.origin || "https://ais-pre-brckc3p3uzrffsj324cxlr-515626289175.europe-west1.run.app";
    
    const message = 
`🛑 *UGANDA MOMO SECURITY WARNING* 🛑

Please warn your friends and family! A mobile money number is listed in the registry:

📱 *Number:* ${number}
📶 *Network:* ${operator || "Unknown Network"}
Rating: *${emoji}*

💬 *Registry Reason / Details:*
"${reason}"
${scamType ? `📌 *Category:* ${scamType}\n` : ""}
Verify any Ugandan Mobile Money number instantly on the Uganda MoMo Security Registry:
🔗 ${appUrl}`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  };

  // --- USSD OFFLINE SIMULATOR STATES ---
  const [ussdDialText, setUssdDialText] = useState(""); // Holds what is dialed on the keypad
  const [ussdActive, setUssdActive] = useState(false); // True when a USSD session is running
  const [ussdScreen, setUssdScreen] = useState<
    "MAIN" | "CHECK_PROMPT" | "CHECK_RESULT" | "REPORT_PROMPT" | "REPORT_REASON" | "REPORT_SUCCESS" | "TIPS" | "MTN_MAIN" | "MTN_REPORT" | "AIRTEL_MAIN" | "AIRTEL_REPORT" | "ERROR"
  >("MAIN");
  const [ussdInputValue, setUssdInputValue] = useState(""); // Input during active USSD
  const [ussdMessage, setUssdMessage] = useState(""); // LCD display text
  const [ussdQueryNumber, setUssdQueryNumber] = useState(""); // Number being operated in USSD
  const [ussdCopied, setUssdCopied] = useState(false);

  const handleUssdCopy = () => {
    const textToCopy = ussdActive ? ussdMessage : ussdDialText;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setUssdCopied(true);
    setTimeout(() => setUssdCopied(false), 2000);
  };

  const handleUssdCall = () => {
    const cleaned = ussdDialText.trim();
    if (cleaned === "*256*5#") {
      setUssdActive(true);
      setUssdScreen("MAIN");
      setUssdInputValue("");
      setUssdMessage(
        "MOMO Scam Checker (UG)\n" +
        "1. Check MoMo Number\n" +
        "2. Report Scam\n" +
        "3. Quick Safety Tips"
      );
    } else if (cleaned === "*165#") {
      setUssdActive(true);
      setUssdScreen("MTN_MAIN");
      setUssdInputValue("");
      setUssdMessage(
        "MTN MoMo\n" +
        "1. Send Money\n" +
        "2. Airtime & Bundles\n" +
        "3. Withdraw Cash\n" +
        "4. Pay Bills\n" +
        "5. Wewole Loans\n" +
        "6. My Account\n" +
        "7. Report Fraud / Block"
      );
    } else if (cleaned === "*185#") {
      setUssdActive(true);
      setUssdScreen("AIRTEL_MAIN");
      setUssdInputValue("");
      setUssdMessage(
        "Airtel Money\n" +
        "1. Send Money\n" +
        "2. Buy Airtime\n" +
        "3. Withdraw Cash\n" +
        "4. Pay Bills\n" +
        "5. Airtel Wewole\n" +
        "6. Fraud Security / Support"
      );
    } else if (cleaned) {
      setUssdActive(true);
      setUssdScreen("ERROR");
      setUssdMessage("Connection problem or\ninvalid MMI code.");
    }
  };

  const handleUssdSend = () => {
    const val = ussdInputValue.trim();
    setUssdInputValue(""); // Clear input

    if (ussdScreen === "MAIN") {
      if (val === "1") {
        setUssdScreen("CHECK_PROMPT");
        setUssdMessage("Enter Mobile Money\nnumber to check:\n(e.g., 0772109843)");
      } else if (val === "2") {
        setUssdScreen("REPORT_PROMPT");
        setUssdMessage("Enter Fraudulent Number:\n(e.g., 0772000111)");
      } else if (val === "3") {
        setUssdScreen("TIPS");
        setUssdMessage(
          "Safety Tips:\n" +
          "1. Never give PIN/OTP.\n" +
          "2. Support has no fees.\n" +
          "3. Verify payee name.\n" +
          "0. Back"
        );
      } else {
        setUssdMessage(
          "Invalid selection.\n" +
          "MOMO Scam Checker (UG)\n" +
          "1. Check MoMo Number\n" +
          "2. Report Scam\n" +
          "3. Quick Safety Tips"
        );
      }
    } else if (ussdScreen === "CHECK_PROMPT") {
      if (!val) {
        setUssdMessage("Error: Number required.\nEnter MoMo number to check:\n(e.g., 0772109843)");
        return;
      }
      const cleaned = cleanPhoneNumber(val);
      setUssdQueryNumber(cleaned);

      // Check userReports first
      const matchedReport = userReports.find(r => cleanPhoneNumber(r.number) === cleaned);
      if (matchedReport) {
        setUssdScreen("CHECK_RESULT");
        setUssdMessage(
          `Result: WARNING!\n` +
          `Operator: ${matchedReport.operator}\n` +
          `Community flagged:\n"${matchedReport.reason.substring(0, 30)}..."\n\n` +
          `0. Back`
        );
      } else if (SCAM_DATABASE[cleaned]) {
        const record = SCAM_DATABASE[cleaned];
        setUssdScreen("CHECK_RESULT");
        setUssdMessage(
          `Result: ${record.status}!\n` +
          `Operator: ${record.operator}\n` +
          `Reason:\n"${record.reason.substring(0, 32)}..."\n\n` +
          `0. Back`
        );
      } else {
        const op = getTelecomOperator(cleaned);
        setUssdScreen("CHECK_RESULT");
        setUssdMessage(
          `Result: SAFE!\n` +
          `Operator: ${op}\n` +
          `No active reports in registry.\n\n` +
          `0. Back`
        );
      }
    } else if (ussdScreen === "CHECK_RESULT") {
      if (val === "0") {
        setUssdScreen("MAIN");
        setUssdMessage(
          "MOMO Scam Checker (UG)\n" +
          "1. Check MoMo Number\n" +
          "2. Report Scam\n" +
          "3. Quick Safety Tips"
        );
      } else {
        setUssdMessage("Press 0 to return to Main Menu.");
      }
    } else if (ussdScreen === "REPORT_PROMPT") {
      if (!val || val.length < 9) {
        setUssdMessage("Invalid number. Must be at least 9 digits.\nEnter Fraudulent Number:");
        return;
      }
      const cleaned = cleanPhoneNumber(val);
      setUssdQueryNumber(cleaned);
      setUssdScreen("REPORT_REASON");
      setUssdMessage("Enter Reason / Scam Type:\n(e.g. Fake agent transfer)");
    } else if (ussdScreen === "REPORT_REASON") {
      if (!val || val.trim().length < 5) {
        setUssdMessage("Please write a reason (min 5 chars):\nEnter Reason:");
        return;
      }
      
      const op = getTelecomOperator(ussdQueryNumber);
      const newReportObj: UserReport = {
        id: `rep-ussd-${Date.now()}`,
        number: ussdQueryNumber,
        status: "SCAM",
        reason: val.trim(),
        operator: op,
        reportedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        scamType: "USSD Code (*256*5#)"
      };

      setUserReports(prev => [newReportObj, ...prev]);
      setUssdScreen("REPORT_SUCCESS");
      setUssdMessage(
        `SUCCESS!\n` +
        `Number +${ussdQueryNumber} is flagged as SCAM in system.\n\n` +
        `0. Back`
      );
    } else if (ussdScreen === "REPORT_SUCCESS" || ussdScreen === "TIPS") {
      if (val === "0") {
        setUssdScreen("MAIN");
        setUssdMessage(
          "MOMO Scam Checker (UG)\n" +
          "1. Check MoMo Number\n" +
          "2. Report Scam\n" +
          "3. Quick Safety Tips"
        );
      } else {
        setUssdMessage("Press 0 to return to Main Menu.");
      }
    } else if (ussdScreen === "MTN_MAIN") {
      if (val === "7") {
        setUssdScreen("MTN_REPORT");
        setUssdMessage(
          "MTN MoMo Security:\n" +
          "To report fraud or immediately block transaction call 100 or dial *165*4#.\n" +
          "0. Exit"
        );
      } else if (val === "0" || val === "") {
        setUssdActive(false);
        setUssdDialText("");
      } else {
        setUssdMessage("Action selected is disabled in simulation.\n7. Report Fraud / Block\n0. Exit");
      }
    } else if (ussdScreen === "MTN_REPORT" || ussdScreen === "AIRTEL_REPORT") {
      if (val === "0") {
        setUssdActive(false);
        setUssdDialText("");
      } else {
        setUssdMessage("Press 0 to exit.");
      }
    } else if (ussdScreen === "AIRTEL_MAIN") {
      if (val === "6") {
        setUssdScreen("AIRTEL_REPORT");
        setUssdMessage(
          "Airtel Security:\n" +
          "Call 100 to report fake agent calls immediately. Never share PIN/OTP.\n" +
          "0. Exit"
        );
      } else if (val === "0" || val === "") {
        setUssdActive(false);
        setUssdDialText("");
      } else {
        setUssdMessage("Action selected is disabled in simulation.\n6. Fraud Security / Support\n0. Exit");
      }
    } else if (ussdScreen === "ERROR") {
      setUssdActive(false);
      setUssdDialText("");
    }
  };

  const handleUssdCancel = () => {
    setUssdActive(false);
    setUssdDialText("");
    setUssdInputValue("");
  };

  const handleKeypadPress = (key: string) => {
    if (ussdActive) {
      if (key === "*") return;
      setUssdInputValue((prev) => prev + key);
    } else {
      setUssdDialText((prev) => prev + key);
    }
  };

  const handleKeypadBackspace = () => {
    if (ussdActive) {
      setUssdInputValue((prev) => prev.slice(0, -1));
    } else {
      setUssdDialText((prev) => prev.slice(0, -1));
    }
  };

  // Persistent list for user reported numbers (stored in localStorage)
  const [userReports, setUserReports] = useState<UserReport[]>(() => {
    try {
      const saved = localStorage.getItem("ug_momo_user_reports");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error loading reports from localStorage:", e);
    }
    return [
      {
        id: "rep-1",
        number: "256775010203",
        status: "WARNING",
        reason: "Posing as an MTN agent in Nakawa claiming my profile needed validation for a cash grant.",
        operator: "MTN",
        reportedAt: "2026-06-24 10:15",
        scamType: "Impersonating Support"
      },
      {
        id: "rep-2",
        number: "256708991122",
        status: "WARNING",
        reason: "Sent a message saying 'Wewole loan approved' and asked for 20,000 UGX activation fee.",
        operator: "Airtel",
        reportedAt: "2026-06-24 12:40",
        scamType: "Upfront Loan Fees (Wewole)"
      }
    ];
  });

  // Sync userReports to localStorage on change
  React.useEffect(() => {
    try {
      localStorage.setItem("ug_momo_user_reports", JSON.stringify(userReports));
    } catch (e) {
      console.error("Error saving reports to localStorage:", e);
    }
  }, [userReports]);

  // Unified computed database combining default SCAM_DATABASE with user-reported numbers
  const mergedScamDatabase = useMemo(() => {
    const db: Record<string, PhoneRecord> = { ...SCAM_DATABASE };
    
    userReports.forEach((report) => {
      const cleaned = cleanPhoneNumber(report.number);
      if (db[cleaned]) {
        db[cleaned] = {
          ...db[cleaned],
          status: report.status,
          reason: report.reason,
          reportedCount: (db[cleaned].reportedCount || 0) + 1,
        };
      } else {
        db[cleaned] = {
          number: cleaned,
          originalFormat: report.number.startsWith("256") ? `+${report.number}` : `+256 ${report.number.substring(3)}`,
          status: report.status,
          reason: report.reason,
          operator: report.operator,
          reportedCount: 1,
          dateReported: report.reportedAt.split(" ")[0]
        };
      }
    });
    
    return db;
  }, [userReports]);

  // Directory explorer states
  const [explorerTab, setExplorerTab] = useState<"SCAM" | "WARNING" | "SAFE">("SCAM");
  const [explorerSearch, setExplorerSearch] = useState("");

  const filteredExplorerRecords = useMemo(() => {
    let records = Object.values(mergedScamDatabase) as PhoneRecord[];
    
    if (explorerTab) {
      records = records.filter(r => r.status === explorerTab);
    }
    
    if (explorerSearch.trim()) {
      const q = explorerSearch.toLowerCase();
      records = records.filter(r => 
        r.number.includes(q) || 
        r.originalFormat.toLowerCase().includes(q) || 
        r.reason.toLowerCase().includes(q) ||
        r.operator.toLowerCase().includes(q)
      );
    }
    
    return records;
  }, [mergedScamDatabase, explorerTab, explorerSearch]);

  const explorerStats = useMemo(() => {
    const records = Object.values(mergedScamDatabase) as PhoneRecord[];
    const scams = records.filter(n => n.status === "SCAM").length;
    const warnings = records.filter(n => n.status === "WARNING").length;
    const safes = records.filter(n => n.status === "SAFE").length;

    return { scams, warnings, safes };
  }, [mergedScamDatabase]);

  // Dynamic URL & Share copy state
  const [currentUrl, setCurrentUrl] = useState("https://ais-pre-brckc3p3uzrffsj324cxlr-515626289175.europe-west1.run.app");
  const [copiedLink, setCopiedLink] = useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const url = window.location.href;
      if (url && !url.includes("localhost") && !url.includes("127.0.0.1") && url.startsWith("http")) {
        setCurrentUrl(url);
      }
    }
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // State for reporting form
  const [reportNumber, setReportNumber] = useState("");
  const [reportStatus, setReportStatus] = useState<ScamStatus>("SCAM");
  const [reportReason, setReportReason] = useState("");
  const [reportScamType, setReportScamType] = useState("PIN Reversal Demand");
  const [reportOperator, setReportOperator] = useState<TelecomOperator | "">("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  // --- GEMINI AI ASSIST STATES ---
  const [aiRawText, setAiRawText] = useState("");
  const [aiScreenshot, setAiScreenshot] = useState<File | null>(null);
  const [aiScreenshotPreview, setAiScreenshotPreview] = useState<string | null>(null);
  const [aiIsProcessing, setAiIsProcessing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuccessMessage, setAiSuccessMessage] = useState("");

  // Similarity alert states
  const [similarityAlert, setSimilarityAlert] = useState<{
    matchedNumber: string;
    matchedReason: string;
    similarity: number;
    status: string;
  } | null>(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  const handleScreenshotChange = (file: File) => {
    setAiScreenshot(file);
    const url = URL.createObjectURL(file);
    setAiScreenshotPreview(url);
    setAiError("");
    setAiSuccessMessage("");
  };

  const clearScreenshot = () => {
    setAiScreenshot(null);
    if (aiScreenshotPreview) {
      URL.revokeObjectURL(aiScreenshotPreview);
    }
    setAiScreenshotPreview(null);
  };

  const handleAiAutofill = async () => {
    if (!aiRawText && !aiScreenshot) return;
    setAiIsProcessing(true);
    setAiError("");
    setAiSuccessMessage("");

    try {
      const extracted = await extractScamDetails(
        aiRawText || undefined,
        aiScreenshot || undefined
      );
      
      if (extracted.phoneNumber) {
        setReportNumber(extracted.phoneNumber);
        const cleaned = cleanPhoneNumber(extracted.phoneNumber);
        const detected = getTelecomOperator(cleaned);
        if (detected !== "Unknown") {
          setReportOperator(detected);
        }
      }
      if (extracted.category) {
        setReportScamType(extracted.category);
      }
      if (extracted.operator && extracted.operator !== "Unknown") {
        setReportOperator(extracted.operator as TelecomOperator);
      }
      if (extracted.reason) {
        setReportReason(extracted.reason);
      }

      setAiSuccessMessage("Form successfully filled by MoMo Copilot!");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to analyze input with Gemini AI.");
    } finally {
      setAiIsProcessing(false);
    }
  };

  const handleForceSubmit = () => {
    setForceSubmit(true);
  };

  React.useEffect(() => {
    if (forceSubmit) {
      // Trigger report logic manually since state is updated
      const dummyEvent = { preventDefault: () => {} } as React.FormEvent;
      handleReportSubmit(dummyEvent);
    }
  }, [forceSubmit]);

  // Auto-detect operator on report number change
  const handleReportNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReportNumber(val);
    const cleaned = cleanPhoneNumber(val);
    if (cleaned.length >= 5) {
      const detected = getTelecomOperator(cleaned);
      if (detected !== "Unknown") {
        setReportOperator(detected);
      }
    }
  };

  // Handle number lookup search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess(false); // Reset report form message if open
    
    const cleaned = cleanPhoneNumber(searchQuery);
    if (!cleaned) {
      alert("Please enter a valid phone number.");
      return;
    }

    setSearchedNumber(searchQuery);
    setHasSearched(true);

    if (mergedScamDatabase[cleaned]) {
      setSearchResult(mergedScamDatabase[cleaned]);
    } else {
      const detectedOp = getTelecomOperator(cleaned);
      setSearchResult({
        number: cleaned,
        originalFormat: searchQuery.trim().startsWith("+") ? searchQuery : `+256 ${cleaned.substring(3)}`,
        status: "SAFE",
        reason: "CLEAN RECORD: This number has not been reported as fraudulent in our database. Always remain vigilant and confirm recipient names before finalizing any Mobile Money transaction.",
        operator: detectedOp
      });
    }
  };

  // Quick select search from recent lists
  const handleQuickSearch = (num: string) => {
    setSearchQuery(num);
    const cleaned = cleanPhoneNumber(num);
    setSearchedNumber(num);
    setHasSearched(true);
    
    if (mergedScamDatabase[cleaned]) {
      setSearchResult(mergedScamDatabase[cleaned]);
    } else {
      const detectedOp = getTelecomOperator(cleaned);
      setSearchResult({
        number: cleaned,
        originalFormat: num,
        status: "SAFE",
        reason: "CLEAN RECORD: This number has no active reports on the MoMo registry. If you have been scammed by this number, please use the report form to alert others.",
        operator: detectedOp
      });
    }
  };

  // Handle reporting submit
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess(false);

    const cleaned = cleanPhoneNumber(reportNumber);
    if (!cleaned || cleaned.length < 9) {
      setFormError("Please enter a valid Ugandan phone number (e.g. +256772000000 or 0772000000).");
      return;
    }

    if (!reportReason || reportReason.trim().length < 10) {
      setFormError("Please provide a descriptive explanation of what happened (at least 10 characters).");
      return;
    }

    // Similarity Pattern / Duplicate Check
    if (!forceSubmit) {
      setAiIsProcessing(true);
      try {
        const scamPatternPool = (Object.values(mergedScamDatabase) as PhoneRecord[])
          .filter((rec) => rec.status !== "SAFE")
          .map((rec) => ({
            idOrNumber: rec.number,
            reason: rec.reason,
            status: rec.status
          }));

        if (scamPatternPool.length > 0) {
          const similarityResult = await detectSimilarScam(reportReason.trim(), scamPatternPool);
          if (similarityResult) {
            setSimilarityAlert({
              matchedNumber: similarityResult.matchedItem.idOrNumber,
              matchedReason: similarityResult.matchedItem.reason,
              similarity: similarityResult.similarity,
              status: similarityResult.matchedItem.status
            });
            setAiIsProcessing(false);
            return; // Pause the submission, show alert UI
          }
        }
      } catch (err) {
        console.error("Similarity detection failed, skipping:", err);
      } finally {
        setAiIsProcessing(false);
      }
    }

    const op = reportOperator || getTelecomOperator(cleaned);

    // Create new UserReport
    const newReport: UserReport = {
      id: `rep-${Date.now()}`,
      number: cleaned,
      status: reportStatus,
      reason: reportReason.trim(),
      operator: op,
      reportedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      scamType: reportScamType
    };

    // Append to list dynamically (acts as database lookup for this session)
    setUserReports((prev) => [newReport, ...prev]);
    setFormSuccess(true);
    
    // Reset inputs & states
    setReportNumber("");
    setReportStatus("SCAM");
    setReportReason("");
    setReportScamType("PIN Reversal Demand");
    setReportOperator("");
    setSimilarityAlert(null);
    setForceSubmit(false);
  };

  // Database stats calculated dynamically
  const stats = useMemo(() => {
    const records = Object.values(mergedScamDatabase) as PhoneRecord[];
    const scams = records.filter(n => n.status === "SCAM").length;
    const warnings = records.filter(n => n.status === "WARNING").length;
    const safes = records.filter(n => n.status === "SAFE").length;
    const totalInDb = scams + warnings + safes;

    return { totalInDb, scams, warnings, safes };
  }, [mergedScamDatabase]);

  return (
    <div id="app-container" className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* HEADER SECTION (STICKY & STATIC IN VIEW DURING SCROLL) */}
      <header id="app-header" className="bg-slate-900/95 backdrop-blur-md text-white py-4 md:py-5 px-4 sticky top-0 z-50 overflow-hidden border-b-4 border-[#FFCC00] shadow-lg">
        {/* Abstract decorative colors mimicking MTN Yellow and Airtel Red background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFCC00]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#E11919]/10 rounded-full blur-3xl" />
 
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img 
              src={momoShieldLogo} 
              alt="MOMO Scam Checker Logo" 
              className="w-16 h-16 rounded-2xl border-2 border-[#FFCC00] shadow-md flex-shrink-0 object-cover"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-[#FFCC00] text-slate-950 text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">MTN</span>
                <span className="bg-[#E11919] text-white text-[10px] font-black px-2 py-0.5 rounded tracking-wider uppercase">Airtel</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded uppercase">Uganda MoMo Security Registry</span>
              </div>
              <h1 id="main-title" className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-white">
                MOMO Scam Checker
              </h1>
              <p id="main-subtitle" className="text-slate-400 text-sm mt-1 max-w-xl">
                Cross-telecom registry to verify Ugandan Mobile Money numbers. Instantly check if a number is linked to active agent fraud, fake lotteries, or phishing.
              </p>
            </div>
          </div>
 
          {/* Quick Registry Counters */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto text-center">
            <button
              onClick={() => {
                setExplorerTab("SCAM");
                const el = document.getElementById("registry-explorer");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer min-w-[100px] ${
                explorerTab === "SCAM"
                  ? "bg-red-950/40 border-red-500 shadow-md ring-1 ring-red-500/30"
                  : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60"
              }`}
            >
              <div className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Scams
              </div>
              <div className="text-xl font-extrabold text-white mt-1">{stats.scams}</div>
              <span className="text-[9px] text-slate-400 block font-semibold mt-0.5 underline">View List</span>
            </button>
            <button
              onClick={() => {
                setExplorerTab("WARNING");
                const el = document.getElementById("registry-explorer");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer min-w-[100px] ${
                explorerTab === "WARNING"
                  ? "bg-amber-950/40 border-[#FFCC00] shadow-md ring-1 ring-[#FFCC00]/30"
                  : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60"
              }`}
            >
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00]" />
                Warnings
              </div>
              <div className="text-xl font-extrabold text-white mt-1">{stats.warnings}</div>
              <span className="text-[9px] text-slate-400 block font-semibold mt-0.5 underline">View List</span>
            </button>
            <button
              onClick={() => {
                setExplorerTab("SAFE");
                const el = document.getElementById("registry-explorer");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className={`p-3 rounded-xl border text-center transition-all cursor-pointer min-w-[100px] ${
                explorerTab === "SAFE"
                  ? "bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/30"
                  : "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60"
              }`}
            >
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Safe List
              </div>
              <div className="text-xl font-extrabold text-white mt-1">{stats.safes}</div>
              <span className="text-[9px] text-slate-400 block font-semibold mt-0.5 underline">View List</span>
            </button>
          </div>
        </div>
      </header>
 
      {/* MAIN TWO-COLUMN VIEW */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: CHECK A NUMBER (7 COLUMNS) */}
        <section id="check-section" className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#FFCC00] p-1.5 rounded text-slate-900">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Check a Mobile Money Number</h2>
            </div>
            
            <p className="text-slate-600 text-sm mb-6">
              Enter any Ugandan mobile number (MTN, Airtel, Lycamobile, UTL) to verify its safety rating. We clean spaces, brackets, and prefixes instantly.
            </p>

            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 font-semibold text-base">
                  +256
                </div>
                <input
                  id="search-input"
                  type="text"
                  placeholder="772 109 843"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-16 pr-12 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold text-lg text-slate-900 focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all placeholder:text-slate-400"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-slate-400 hover:text-slate-600 text-xs bg-slate-200 hover:bg-slate-300 p-1 rounded-full transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Supports formats: +256 77X..., 077X..., 77X...
                </span>
                {searchQuery.trim().length > 2 && (
                  <span className="font-bold flex items-center gap-1">
                    Detected Carrier: 
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      getTelecomOperator(searchQuery) === "MTN" 
                        ? "bg-[#FFCC00]/20 text-[#8a6c00]" 
                        : getTelecomOperator(searchQuery) === "Airtel"
                        ? "bg-[#E11919]/10 text-[#E11919]"
                        : "bg-slate-200 text-slate-700"
                    }`}>
                      {getTelecomOperator(searchQuery)}
                    </span>
                  </span>
                )}
              </div>

              <button
                id="search-btn"
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <Search className="w-5 h-5 text-[#FFCC00]" /> Check Rating Status
              </button>
            </form>
          </div>

          {/* DYNAMIC RESULT BOX */}
          <AnimatePresence mode="wait">
            {hasSearched && searchResult && (
              <motion.div
                key={searchedNumber}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="rounded-2xl overflow-hidden shadow-md border"
                style={{
                  backgroundColor: 
                    searchResult.status === "SCAM" ? "#FEF2F2" : // red-50
                    searchResult.status === "WARNING" ? "#FFFBEB" : // amber-50
                    "#ECFDF5", // emerald-50
                  borderColor:
                    searchResult.status === "SCAM" ? "#FCA5A5" : // red-300
                    searchResult.status === "WARNING" ? "#FCD34D" : // amber-300
                    "#A7F3D0", // emerald-300
                }}
              >
                {/* Result Header */}
                <div className={`p-4 flex items-center justify-between ${
                  searchResult.status === "SCAM" ? "bg-red-600 text-white" :
                  searchResult.status === "WARNING" ? "bg-amber-500 text-slate-950" :
                  "bg-emerald-600 text-white"
                }`}>
                  <div className="flex items-center gap-2">
                    {searchResult.status === "SCAM" && <AlertTriangle className="w-5 h-5 animate-pulse" />}
                    {searchResult.status === "WARNING" && <ShieldAlert className="w-5 h-5" />}
                    {searchResult.status === "SAFE" && <ShieldCheck className="w-5 h-5" />}
                    <span className="font-extrabold uppercase tracking-wider text-sm">
                      {searchResult.status} STATUS RATING
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
                    {searchResult.operator} Network
                  </span>
                </div>

                {/* Result Body */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Number Queried</span>
                      <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                        {searchResult.originalFormat}
                      </h3>
                    </div>
                    
                    {searchResult.reportedCount ? (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Community Flags</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-sm ${
                          searchResult.status === "SCAM" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          <AlertCircle className="w-4 h-4" /> {searchResult.reportedCount} Reports Filed
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Main Reason / Advice */}
                  <div className={`p-4 rounded-xl mb-4 border ${
                    searchResult.status === "SCAM" ? "bg-red-100/60 border-red-200 text-red-950" :
                    searchResult.status === "WARNING" ? "bg-amber-100/60 border-amber-200 text-amber-950" :
                    "bg-emerald-100/60 border-emerald-200 text-emerald-950"
                  }`}>
                    <h4 className="font-bold text-base mb-1 flex items-center gap-1.5">
                      {searchResult.status === "SCAM" && "⚠️ DANGER DETECTED"}
                      {searchResult.status === "WARNING" && "⚠️ CAUTION REQUIRED"}
                      {searchResult.status === "SAFE" && "✅ NO KNOWN REPORTS"}
                    </h4>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{searchResult.reason}</p>
                  </div>

                  {/* Date details for scam numbers */}
                  {searchResult.dateReported && (
                    <div className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                      <span>Latest incident report cataloged:</span>
                      <strong className="text-slate-700">{searchResult.dateReported}</strong>
                    </div>
                  )}

                  {/* Interactive Action Recommendation */}
                  <div className="border-t border-slate-200/60 pt-4 mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 font-medium">
                      {searchResult.status === "SCAM" && "Action Recommended: Immediately block this number on your device."}
                      {searchResult.status === "WARNING" && "Action Recommended: Request cash through formal bank channels or meet in person."}
                      {searchResult.status === "SAFE" && "Action Recommended: Proceed, but check the recipient's name carefully on your screen."}
                    </span>
                    
                    <div className="flex flex-wrap gap-2 self-start">
                      {searchResult.status !== "SAFE" && (
                        <a
                          href="tel:100" 
                          className="inline-flex items-center gap-1 text-slate-900 hover:text-slate-700 font-bold bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-all text-center"
                        >
                          <PhoneCall className="w-3.5 h-3.5" /> Dial Care (100)
                        </a>
                      )}
                      
                      <a
                        href={getWhatsAppShareUrl(
                          searchResult.originalFormat,
                          searchResult.status,
                          searchResult.reason,
                          searchResult.operator
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-white font-extrabold bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg transition-all text-center shadow-sm cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share Warning
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* QUICK CHECK EXAMPLES (Drawn from database) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
              Quick Test Registry Numbers:
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickSearch("+256772109843")}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-2 rounded-lg border border-red-200 transition-colors flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                +256 772 109 843 (Scam)
              </button>
              <button
                onClick={() => handleQuickSearch("+256775556677")}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-2 rounded-lg border border-amber-200 transition-colors flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                +256 775 556 677 (Warning)
              </button>
              <button
                onClick={() => handleQuickSearch("+256772123456")}
                className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-2 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                +256 772 123 456 (Safe)
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2.5 italic">
              *Click any test number above to see how safe, warning, and scam responses behave instantly.
            </p>
          </div>

          {/* OFFLINE USSD CODE SIMULATOR MOCKUP */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-slate-950 text-[#FFCC00] p-1.5 rounded">
                  <span className="font-mono text-xs font-black">#*#</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Offline USSD Simulator</h2>
                  <p className="text-xs text-slate-500">Test with no internet connection</p>
                </div>
              </div>
              <span className="bg-[#FFCC00]/10 text-[#8a6c00] text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-[#FFCC00]/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#FFCC00]" /> Feature Phone Mockup
              </span>
            </div>
 
            <p className="text-slate-600 text-xs leading-relaxed">
              In Uganda, millions of users query MoMo rates and security alerts offline using USSD dial codes on analog button phones. Click a preset code below to launch the interactive simulation screen:
            </p>
 
            {/* USSD PRESET BUTTONS */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setUssdDialText("*256*5#");
                  setUssdActive(false);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black border text-center transition-all cursor-pointer ${
                  ussdDialText === "*256*5#" && !ussdActive
                    ? "bg-[#FFCC00] border-[#FFCC00] text-slate-950 font-bold"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                *256*5#
                <span className="block text-[9px] font-medium text-slate-400 mt-0.5">Scam Registry</span>
              </button>
              <button
                onClick={() => {
                  setUssdDialText("*165#");
                  setUssdActive(false);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black border text-center transition-all cursor-pointer ${
                  ussdDialText === "*165#" && !ussdActive
                    ? "bg-[#FFCC00] border-[#FFCC00] text-slate-950 font-bold"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                *165#
                <span className="block text-[9px] font-medium text-slate-400 mt-0.5">MTN MoMo</span>
              </button>
              <button
                onClick={() => {
                  setUssdDialText("*185#");
                  setUssdActive(false);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black border text-center transition-all cursor-pointer ${
                  ussdDialText === "*185#" && !ussdActive
                    ? "bg-[#FFCC00] border-[#FFCC00] text-slate-950 font-bold"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                }`}
              >
                *185#
                <span className="block text-[9px] font-medium text-slate-400 mt-0.5">Airtel Money</span>
              </button>
            </div>

            {/* VIRTUAL PHONE FRAME */}
            <div className="w-full max-w-[280px] mx-auto bg-slate-800 rounded-[30px] p-4 shadow-xl border-4 border-slate-700 flex flex-col gap-4 relative">
              
              {/* Phone Speaker & Camera detail */}
              <div className="flex justify-center items-center gap-1.5 -mt-1 mb-1">
                <div className="w-12 h-1 bg-slate-950 rounded-full" />
                <div className="w-2 h-2 bg-slate-900 rounded-full" />
              </div>

              {/* RETRO LCD SCREEN BACKLIGHT */}
              <div className="bg-[#a3b18a] p-3 rounded-lg border-4 border-slate-950 text-slate-950 font-mono text-xs flex flex-col justify-between h-[190px] shadow-inner select-none relative overflow-hidden">
                {/* LCD pixel lines decoration */}
                <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/5 to-transparent pointer-events-none" />

                {/* Status Bar */}
                <div className="flex justify-between items-center text-[10px] border-b border-slate-950/30 pb-1 mb-1 font-bold">
                  <span>📶 UG_TEL</span>
                  <button 
                    onClick={handleUssdCopy} 
                    className="text-[9px] bg-slate-950/15 hover:bg-slate-950/25 active:bg-slate-950/40 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-all border border-slate-950/20 text-slate-950 font-black"
                    title="Copy display text to clipboard"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    {ussdCopied ? "COPIED!" : "COPY"}
                  </button>
                  <span>🔋 99%</span>
                </div>

                {/* Display Body */}
                <div className="flex-grow flex flex-col justify-between text-[11px] leading-tight whitespace-pre overflow-y-auto">
                  {!ussdActive ? (
                    // IDLE DIALER STATE
                    <div className="flex flex-col justify-center items-center h-full text-center">
                      <span className="text-slate-800 text-[10px] uppercase font-bold tracking-wider mb-2">Ready to Dial</span>
                      <div className="bg-slate-950/10 px-2 py-1.5 w-full rounded font-black text-center text-sm break-all tracking-wide border border-transparent">
                        {ussdDialText || "[ Enter Code ]"}
                      </div>
                      <p className="text-[9px] text-slate-700 mt-2 font-medium">
                        Use buttons below or click preset to enter USSD.
                      </p>
                    </div>
                  ) : (
                    // ACTIVE USSD SCREEN DIALOGUE
                    <div className="flex flex-col justify-between h-full">
                      <div className="flex-grow">
                        <p className="font-bold border-b border-slate-950/20 pb-0.5 mb-1">USSD Request:</p>
                        <p className="text-slate-900 font-bold leading-snug whitespace-pre-line">{ussdMessage}</p>
                      </div>

                      {/* Display active USSD prompt input */}
                      {ussdScreen !== "ERROR" && ussdScreen !== "MTN_REPORT" && ussdScreen !== "AIRTEL_REPORT" && (
                        <div className="mt-1 border-t border-slate-950/20 pt-1">
                          <input
                            type="text"
                            placeholder="Type response..."
                            value={ussdInputValue}
                            onChange={(e) => setUssdInputValue(e.target.value)}
                            className="w-full bg-slate-950/10 border-b border-slate-950 focus:outline-none text-[11px] font-mono font-bold px-1 py-0.5 text-slate-950 placeholder:text-slate-800/40"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LCD Footer Softkeys Label */}
                <div className="flex justify-between items-center text-[9px] font-bold border-t border-slate-950/30 pt-1 mt-1">
                  {!ussdActive ? (
                    <>
                      <span>[ CALL ]</span>
                      <span>[ CLEAR ]</span>
                    </>
                  ) : (
                    <>
                      <button onClick={handleUssdSend} className="hover:underline font-black cursor-pointer">[ SEND ]</button>
                      <button onClick={handleUssdCancel} className="hover:underline font-black cursor-pointer">[ CANCEL ]</button>
                    </>
                  )}
                </div>
              </div>

              {/* PHYSICAL KEYPAD */}
              <div className="flex flex-col gap-2">
                {/* Softkeys row */}
                <div className="grid grid-cols-2 gap-4 px-2">
                  <button
                    onClick={ussdActive ? handleUssdSend : handleUssdCall}
                    className="bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold py-1 px-3 rounded-full text-[10px] shadow border border-emerald-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    {ussdActive ? "SEND" : "CALL"}
                  </button>
                  <button
                    onClick={ussdActive ? handleUssdCancel : handleKeypadBackspace}
                    className="bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-bold py-1 px-3 rounded-full text-[10px] shadow border border-red-800 transition-all text-center cursor-pointer"
                  >
                    {ussdActive ? "EXIT" : "CLEAR"}
                  </button>
                </div>

                {/* Numeric dialpad buttons */}
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {[
                    { num: "1", alpha: "o_o" },
                    { num: "2", alpha: "abc" },
                    { num: "3", alpha: "def" },
                    { num: "4", alpha: "ghi" },
                    { num: "5", alpha: "jkl" },
                    { num: "6", alpha: "mno" },
                    { num: "7", alpha: "pqrs" },
                    { num: "8", alpha: "tuv" },
                    { num: "9", alpha: "wxyz" },
                    { num: "*", alpha: "+" },
                    { num: "0", alpha: "space" },
                    { num: "#", alpha: "⇧" }
                  ].map((btn) => (
                    <button
                      key={btn.num}
                      type="button"
                      onClick={() => handleKeypadPress(btn.num)}
                      className="bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white p-2 rounded-lg border-b-2 border-slate-950 shadow transition-all text-center active:translate-y-0.5 cursor-pointer"
                    >
                      <div className="font-bold text-xs">{btn.num}</div>
                      <div className="text-[8px] text-slate-400 font-medium leading-none tracking-wider uppercase">
                        {btn.alpha}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Branding label */}
              <div className="text-center text-[9px] font-black tracking-widest text-slate-500 uppercase -mb-1 mt-1">
                ⚡ NOKIA 3310 - MOMO ED. ⚡
              </div>

            </div>

            {/* Quick Helper instructions */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-500">
              <span className="font-bold text-slate-800 block mb-1">💡 Simulator Sandbox Instructions:</span>
              <ul className="list-disc list-inside space-y-1">
                <li>Click <code className="bg-white px-1.5 py-0.5 border rounded font-mono font-bold text-slate-700">*256*5#</code> preset.</li>
                <li>Press <strong className="text-emerald-700">CALL</strong> to run the offline MoMo Security Registry interface.</li>
                <li>Enter <strong className="font-mono text-slate-700">1</strong> on phone keypad or dialer input, and press <strong className="text-slate-700">SEND</strong> to verify a number.</li>
                <li>Try checking reported numbers like <code className="font-mono font-bold bg-white px-1">0772109843</code> to experience real-time warning alerts offline.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: REPORT FRAUD & RECENT REPORTS (5 COLUMNS) */}
        <section id="report-section" className="lg:col-span-5 flex flex-col gap-6">
          
          {/* REPORT FORM */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            {/* Top accent visual bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#E11919]" />
            
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#E11919] p-1.5 rounded text-white">
                <Send className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Report Fraud / Scam Alert</h2>
            </div>

            <p className="text-slate-600 text-sm mb-5">
              Have you encountered a suspicious caller? Share their details dynamically below so others checking in this session stay protected.
            </p>

            {/* AI Assistant Section */}
            <div className="mb-6 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/80 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="bg-indigo-600 text-white p-1 rounded-md">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">MoMo Copilot AI Autofill</span>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">Gemini 2.5 Flash</span>
              </div>
              <p className="text-slate-600 text-[11px] mb-3 leading-relaxed">
                Paste a raw fraudulent SMS message, incident description, or upload a screenshot of the scam message to instantly extract key fields.
              </p>

              <div className="space-y-3">
                {/* Text area for raw details */}
                <div>
                  <textarea
                    placeholder="Paste raw SMS or incident details here... (e.g. 'Y'ello! You have won 1,000,000 UGX in the promotion! Call 0772109843 to claim...')"
                    value={aiRawText}
                    onChange={(e) => setAiRawText(e.target.value)}
                    rows={2}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-400"
                  />
                </div>

                {/* Screenshot upload container with Drag-and-Drop support */}
                <div>
                  <div 
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith("image/")) {
                        handleScreenshotChange(file);
                      }
                    }}
                    className="border border-dashed border-slate-300 hover:border-indigo-400 bg-white/70 rounded-lg p-3 text-center transition-all cursor-pointer relative"
                  >
                    <input
                      id="ai-screenshot-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleScreenshotChange(file);
                      }}
                      className="hidden"
                    />
                    <label htmlFor="ai-screenshot-upload" className="cursor-pointer block">
                      {aiScreenshotPreview ? (
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2">
                            <img src={aiScreenshotPreview} alt="Preview" className="w-8 h-8 rounded object-cover border border-slate-200" referrerPolicy="no-referrer" />
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{aiScreenshot?.name}</p>
                              <p className="text-[10px] text-slate-400">{(aiScreenshot!.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              clearScreenshot();
                            }}
                            className="text-[10px] font-black text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-indigo-700">📸 Drag or Select Screenshot</span>
                          <span className="text-[9px] text-slate-400 font-medium">PNG, JPG, JPEG (SMS screenshots, transaction receipts)</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Extraction action trigger */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {aiIsProcessing ? (
                    <div className="flex items-center gap-1.5 text-indigo-600 font-extrabold text-xs animate-pulse py-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-500" /> CoPilot is analyzing & autofilling...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAiAutofill}
                      disabled={!aiRawText && !aiScreenshot}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black py-2.5 px-3 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Run AI Form Autofill
                    </button>
                  )}
                </div>

                {/* AI feedback states */}
                {aiError && (
                  <div className="p-2.5 bg-red-50 text-red-800 text-[11px] rounded-lg border border-red-100 font-medium">
                    {aiError}
                  </div>
                )}
                {aiSuccessMessage && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 text-[11px] rounded-lg border border-emerald-100 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {aiSuccessMessage}
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  placeholder="+2567XXXXXXXX or 07XXXXXXXX"
                  value={reportNumber}
                  onChange={handleReportNumberChange}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Risk Rating *
                  </label>
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value as ScamStatus)}
                    className="block w-full px-1.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-900 focus:outline-none focus:border-red-500 transition-colors font-semibold"
                  >
                    <option value="SCAM">🚨 SCAM</option>
                    <option value="WARNING">⚠️ WARNING</option>
                    <option value="SAFE">✅ SAFE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={reportScamType}
                    onChange={(e) => setReportScamType(e.target.value)}
                    className="block w-full px-1.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-900 focus:outline-none focus:border-red-500 transition-colors font-medium"
                  >
                    <option value="PIN Reversal Demand">PIN Reversal</option>
                    <option value="Impersonating Support">Impersonating</option>
                    <option value="Fake Promotion/Lottery Wins">Lottery Win</option>
                    <option value="Upfront Loan Fees (Wewole)">Wewole Loan</option>
                    <option value="School Emergency Impersonator">School Emergency</option>
                    <option value="Other Fraud">Other Fraud</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Operator *
                  </label>
                  <select
                    value={reportOperator}
                    onChange={(e) => setReportOperator(e.target.value as TelecomOperator)}
                    className="block w-full px-1.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-900 focus:outline-none focus:border-red-500 transition-colors font-medium"
                    required
                  >
                    <option value="">Auto-Detect</option>
                    <option value="MTN">MTN Uganda</option>
                    <option value="Airtel">Airtel Uganda</option>
                    <option value="Lyca">Lycamobile</option>
                    <option value="UTL">UTL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Incident Reason & Details *
                </label>
                <textarea
                  placeholder="Describe what the scammer asked you to do. e.g. Asked me to press *165# to return wrong money transaction..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  rows={3}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white transition-colors resize-none placeholder:text-slate-400"
                  required
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-100 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-100 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>Report submitted successfully! This number is now logged into your persistent database directory.</span>
                </div>
              )}

              {similarityAlert && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/80 shadow-sm space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">Similar Scam Script Pattern Detected!</h4>
                      <p className="text-[11px] text-amber-800 leading-normal mt-0.5">
                        We detected a highly similar reported incident in our database with <span className="font-extrabold">{(similarityAlert.similarity * 100).toFixed(1)}% similarity match</span>.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 p-3 rounded-lg border border-amber-100 text-xs">
                    <div className="flex items-center justify-between mb-1.5 font-bold text-slate-800">
                      <span className="font-mono text-[11px]">Number: +{similarityAlert.matchedNumber}</span>
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                        {similarityAlert.status}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] italic leading-relaxed">
                      "{similarityAlert.matchedReason}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleForceSubmit}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer text-center"
                    >
                      Yes, Report Anyway
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimilarityAlert(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-2 px-3 rounded-lg text-xs transition-all border border-slate-200 cursor-pointer text-center"
                    >
                      Cancel & Edit
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#E11919] hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <Plus className="w-4 h-4" /> File Session Scam Alert
              </button>
            </form>
          </div>

          {/* RECENT FEED (DYNAMIC LOCAL REPORTS STATE) */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E11919] animate-pulse"></span>
                Active Community Reports
              </h3>
              <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                {userReports.length} session logs
              </span>
            </div>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {userReports.map((report) => (
                <div 
                  key={report.id} 
                  className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      +{report.number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      report.operator === "MTN" 
                        ? "bg-[#FFB800]/10 text-[#a37500] border border-[#FFB800]/20" 
                        : "bg-[#E11919]/10 text-[#E11919] border border-[#E11919]/20"
                    }`}>
                      {report.operator}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="bg-slate-200 text-slate-800 font-black px-1.5 py-0.5 rounded-[4px] text-[10px]">
                      {report.scamType}
                    </span>
                    <span className="text-slate-400 font-medium">{report.reportedAt}</span>
                  </div>

                  <p className="text-slate-600 leading-relaxed italic bg-white p-2 rounded-lg border border-slate-100">
                    "{report.reason}"
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleQuickSearch(`+${report.number}`)}
                      className="text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline inline-flex items-center gap-0.5"
                    >
                      Verify Rating <ArrowRight className="w-3 h-3" />
                    </button>
                    
                    <a
                      href={getWhatsAppShareUrl(
                        `+${report.number}`,
                        report.status,
                        report.reason,
                        report.operator,
                        report.scamType
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2 py-1 rounded-md transition-all cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" /> Share Warning
                    </a>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-[10px] text-slate-400 mt-3 text-center italic">
              *Reports logged above will trigger a Warning if searched in the lookup tool.
            </p>
          </div>
        </section>
      </main>
 
      {/* REGISTRY EXPLORER SECTION */}
      <section id="registry-explorer" className="max-w-7xl w-full mx-auto p-4 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[#FFCC00]" />
                Interactive Registry Explorer
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Browse, search, and verify entire directories of flagged scam, suspicious warning, and verified safe MoMo numbers.
              </p>
            </div>
            
            {/* Inline search filter inside the explorer */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter explorer directory..."
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all"
              />
              {explorerSearch && (
                <button 
                  onClick={() => setExplorerSearch("")} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-1.5 py-0.5 rounded"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Directory tabs */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <button
              onClick={() => setExplorerTab("SCAM")}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold transition-all border text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                explorerTab === "SCAM"
                  ? "bg-red-50 border-red-300 text-red-700 shadow-sm"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full bg-red-600 ${explorerTab === "SCAM" ? "animate-pulse" : ""}`} />
              Scam Directory ({explorerStats.scams})
            </button>
            <button
              onClick={() => setExplorerTab("WARNING")}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold transition-all border text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                explorerTab === "WARNING"
                  ? "bg-amber-50 border-[#FFCC00]/40 text-amber-800 shadow-sm"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFCC00]" />
              Warning Registry ({explorerStats.warnings})
            </button>
            <button
              onClick={() => setExplorerTab("SAFE")}
              className={`py-3 px-4 rounded-xl text-xs font-extrabold transition-all border text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                explorerTab === "SAFE"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Verified Safe List ({explorerStats.safes})
            </button>
          </div>

          {/* Directory Content List */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Registry Reason & Community Report Details</th>
                  <th className="py-3 px-4">Verification Type</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExplorerRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      No records found in this category matching "{explorerSearch}".
                    </td>
                  </tr>
                ) : (
                  filteredExplorerRecords.map((record) => (
                    <tr 
                      key={record.number} 
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                        {record.originalFormat}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          record.operator === "MTN" 
                            ? "bg-[#FFCC00]/10 text-[#8a6c00] border border-[#FFCC00]/20" 
                            : record.operator === "Airtel"
                            ? "bg-red-50 text-red-600 border border-red-100"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {record.operator}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600 max-w-md leading-relaxed">
                        {record.reason}
                        {record.dateReported && (
                          <span className="block text-[10px] text-slate-400 mt-1 font-bold">
                            Logged: {record.dateReported}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {record.reportedCount && record.reportedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                            ⚠️ Community Flags ({record.reportedCount})
                          </span>
                        ) : record.status === "SAFE" ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                            ✅ Vetted Safe User
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                            📋 Database Record
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={getWhatsAppShareUrl(
                              record.originalFormat,
                              record.status,
                              record.reason,
                              record.operator
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Share Details on WhatsApp"
                            className="text-[11px] font-extrabold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Share2 className="w-3 h-3 text-emerald-600" /> Share
                          </a>

                          <button
                            onClick={() => {
                              handleQuickSearch(record.originalFormat);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="text-[11px] font-extrabold bg-slate-900 hover:bg-[#FFCC00] hover:text-slate-900 text-white px-3 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            Verify <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
 
      {/* EDUCATIONAL RESOURCE SECTION */}
      <section id="educational-section" className="bg-slate-900 text-white border-t-2 border-[#E11919] py-12 px-4 mt-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-[#FFCC00] p-1.5 rounded text-slate-900">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-black text-white">How To Avoid Mobile Money Scams in Uganda</h2>
          </div>
 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Guide Item 1 */}
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/50">
              <div className="bg-red-500/10 text-red-400 p-2 rounded-lg w-fit mb-4 font-bold text-xs uppercase tracking-wider">
                Scam Tactic #1
              </div>
              <h3 className="text-lg font-bold text-white mb-2">The "Wrong Number" Reversal</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                The scammer calls you in distress claiming they accidentally transferred money to your account for hospital fees, requesting a transfer back. They then send a fake SMS styled exactly like an MTN MoMo or Airtel Money notification.
              </p>
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-xs">
                <span className="font-extrabold text-[#FFCC00] block mb-1">⚡ Safety Defense:</span>
                Never dial codes suggested by callers or reply immediately. Hang up, check your actual balance using <code className="text-white font-bold">*165#</code> (MTN) or <code className="text-white font-bold">*185#</code> (Airtel) to verify if funds actually arrived.
              </div>
            </div>
 
            {/* Guide Item 2 */}
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/50">
              <div className="bg-amber-500/10 text-amber-400 p-2 rounded-lg w-fit mb-4 font-bold text-xs uppercase tracking-wider">
                Scam Tactic #2
              </div>
              <h3 className="text-lg font-bold text-white mb-2">The "SIM Registration Upgrade"</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Fraudsters pose as official customer care agents from Kampala claiming your SIM card registration is expired and is about to be deactivated. They request your Mobile Money PIN or the OTP (One-Time Password) sent to your screen to "renew" it.
              </p>
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-xs">
                <span className="font-extrabold text-[#FFCC00] block mb-1">⚡ Safety Defense:</span>
                Telecom companies will never ask for your PIN or OTP on the phone. Hang up and dial official customer service at <strong className="text-white">100</strong>.
              </div>
            </div>
 
            {/* Guide Item 3 */}
            <div className="bg-slate-800/60 p-6 rounded-xl border border-slate-700/50">
              <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg w-fit mb-4 font-bold text-xs uppercase tracking-wider">
                Scam Tactic #3
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Lottery and Wewole Loans</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Unsolicited messages claiming you have won millions of UGX in promotional campaigns or are pre-approved for quick mobile loans. You are directed to call an agent who requests an upfront processing or tax fee via MoMo.
              </p>
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 text-xs">
                <span className="font-extrabold text-[#FFCC00] block mb-1">⚡ Safety Defense:</span>
                Authentic promotions from MTN or Airtel never require winners to pay an upfront fee to redeem rewards. Avoid sending deposits to brokers for unsecured loans.
              </div>
            </div>
 
          </div>
 
          {/* Official Telecom Codes Table */}
          <div className="mt-10 bg-slate-800/40 p-6 rounded-2xl border border-slate-700/40">
            <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6">
              
              {/* Left side: Telecom Hotlines */}
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <PhoneCall className="w-4.5 h-4.5 text-[#FFCC00]" />
                  Official Emergency Hotlines & Menus in Uganda
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
                    <strong className="text-[#FFCC00] block text-sm mb-1">MTN Customer Support</strong>
                    <p className="text-slate-300">Call Support: <strong className="text-white">100</strong></p>
                    <p className="text-slate-300">Whatapp help: <strong className="text-white">0771 100 100</strong></p>
                  </div>
                  <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
                    <strong className="text-[#E11919] block text-sm mb-1">Airtel Customer Support</strong>
                    <p className="text-slate-300">Call Support: <strong className="text-white">100</strong></p>
                    <p className="text-slate-300">Twitter support: <strong className="text-white">@Airtel_Ug</strong></p>
                  </div>
                  <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
                    <strong className="text-slate-300 block text-sm mb-1">MTN MoMo Block</strong>
                    <p className="text-slate-300">Dial: <strong className="text-white">*165#</strong></p>
                    <p className="text-slate-300">Follow prompts to block or dispute transactions instantly.</p>
                  </div>
                  <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
                    <strong className="text-slate-300 block text-sm mb-1">Airtel Money Help</strong>
                    <p className="text-slate-300">Dial: <strong className="text-white">*185#</strong></p>
                    <p className="text-slate-300">Access support options to reverse incorrect transactions.</p>
                  </div>
                </div>

                {/* Partner Telecom Service Providers */}
                <div className="mt-6 pt-5 border-t border-slate-700/35">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#FFCC00] rounded-full animate-pulse" />
                    Official Co-operating Telecom Partners & Registrars
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* MTN Uganda */}
                    <div className="bg-[#FFCC00] h-11 px-3 rounded-xl flex items-center justify-center border border-yellow-500 shadow-sm transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer">
                      <div className="border-2 border-slate-900 rounded-full py-0.5 px-4 flex items-center justify-center">
                        <span className="text-slate-900 font-black text-xs tracking-tighter">MTN</span>
                      </div>
                    </div>

                    {/* Airtel Uganda */}
                    <div className="bg-white h-11 px-3 rounded-xl flex items-center justify-center gap-1 border border-slate-200 shadow-sm transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer">
                      <div className="bg-[#E11919] text-white font-extrabold w-5 h-5 rounded-full flex items-center justify-center text-[10px] italic">a</div>
                      <span className="text-[#E11919] font-black text-xs tracking-tight lowercase">airtel</span>
                    </div>

                    {/* Lyca Mobile */}
                    <div className="bg-white h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer">
                      <span className="text-[#091D5C] font-black text-xs tracking-tight">Lyca</span>
                      <span className="text-slate-600 font-bold text-[9px]">Mobile</span>
                      <div className="flex items-center -space-x-1">
                        <div className="w-2.5 h-2.5 bg-[#00B050] rounded-full opacity-90" />
                        <div className="w-2.5 h-2.5 bg-[#0070C0] rounded-full opacity-90" />
                      </div>
                    </div>

                    {/* Uganda Telecom */}
                    <div className="bg-[#004B93] h-11 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-blue-700 shadow-sm transition-all hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer">
                      <div className="w-5 h-5 rounded-full border border-white flex flex-col items-center justify-center relative flex-shrink-0">
                        <div className="flex gap-0.5 mb-0.5">
                          <div className="w-0.5 h-0.5 bg-white rounded-full" />
                          <div className="w-0.5 h-0.5 bg-white rounded-full" />
                        </div>
                        <div className="w-1.5 h-1 border-b border-r border-l border-white rounded-b-sm" />
                      </div>
                      <div className="flex flex-col text-left leading-none">
                        <span className="text-white font-black text-[9px] tracking-tight whitespace-nowrap">uganda telecom</span>
                        <span className="text-blue-200 text-[6px] font-bold tracking-tighter whitespace-nowrap">It's all about U</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right side: QR Code Card & Relocated Security Tip */}
              <div className="lg:w-80 flex flex-col gap-3">
                {/* QR Code Card */}
                <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
                  <div className="flex items-center gap-1.5 mb-2.5 z-10">
                    <QrCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">Scan & Share App</span>
                  </div>
                  
                  {/* QR Code Frame with White Canvas for Perfect Scanning Contrast */}
                  <div className="bg-white p-2.5 rounded-xl shadow-lg border-2 border-[#FFCC00]/80 mb-3 hover:scale-[1.02] transition-transform duration-300 z-10">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&color=0f172a&bgcolor=ffffff&qzone=1&data=${encodeURIComponent(currentUrl)}`}
                      alt="Scan to access MOMO Scam Checker" 
                      className="w-28 h-28 select-none"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <p className="text-[10px] text-slate-300 max-w-[230px] leading-relaxed mb-3 z-10">
                    Open your camera to scan and immediately run this registry on your mobile phone.
                  </p>

                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-950 text-slate-200 hover:text-white font-bold py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-[11px] cursor-pointer z-10"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied URL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#FFCC00]" />
                        <span>Copy Direct Link</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Relocated Security Tip Card */}
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl flex items-start gap-2.5 shadow-sm">
                  <span className="text-lg leading-none" aria-hidden="true">⚠️</span>
                  <div className="text-left text-[11px] leading-relaxed text-amber-200">
                    <strong className="text-amber-400 block mb-0.5">MOMO Security Tip:</strong>
                    Never share your Mobile Money <strong className="text-white">OTP</strong> (One-Time Password), <strong className="text-white">PIN</strong>, or password with anyone, including callers claiming to be telecom agents!
                  </div>
                </div>
              </div>

            </div>
          </div>
 
        </div>
      </section>
 
      {/* FOOTER */}
      <footer id="app-footer" className="bg-slate-950 text-slate-500 py-6 px-4 text-center text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p>
            &copy; 2026 MOMO Scam Checker - Uganda. Powered by the Uganda Mobile Money Security Community.
          </p>
          <p className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Session Sync Active
          </p>
        </div>
      </footer>
 
    </div>
  );
}
