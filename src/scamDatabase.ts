import { PhoneRecord, TelecomOperator } from "./types";

// Helper function to clean phone numbers to a standard format (e.g. 256772123456)
export function cleanPhoneNumber(numStr: string): string {
  // Strip all non-numeric characters
  const cleaned = numStr.replace(/\D/g, "");
  
  // If it starts with 07..., replace with 2567...
  if (cleaned.startsWith("07") && cleaned.length === 10) {
    return "256" + cleaned.substring(1);
  }
  
  // If it starts with 7... (e.g. 772123456) and is 9 digits, add 256
  if (cleaned.startsWith("7") && cleaned.length === 9) {
    return "256" + cleaned;
  }
  
  return cleaned;
}

// Helper to identify operator based on prefix in Uganda
export function getTelecomOperator(numStr: string): TelecomOperator {
  const cleaned = cleanPhoneNumber(numStr);
  
  // Ugandan mobile phone prefixes check (after 256)
  // MTN: 77, 78, 76, 31, 39
  // Airtel: 70, 75, 74, 20
  if (/^256(77|78|76|31|39)/.test(cleaned)) {
    return "MTN";
  }
  if (/^256(70|75|74|20)/.test(cleaned)) {
    return "Airtel";
  }
  if (/^25671/.test(cleaned)) {
    return "UTL";
  }
  if (/^25672/.test(cleaned)) {
    return "Lyca";
  }
  return "Unknown";
}

// USER CUSTOMIZATION: ADD MORE SCAM NUMBERS HERE
// # USER CUSTOMIZATION: ADD MORE SCAM NUMBERS HERE
export const SCAM_DATABASE: Record<string, PhoneRecord> = {
  // --- 5 SCAM NUMBERS ---
  "256772109843": {
    number: "256772109843",
    originalFormat: "+256 772 109 843",
    status: "SCAM",
    reason: "Fake Mobile Money Agent Scam. Suspect calls victims claiming a 'wrongful cash transfer' of 500,000 UGX was made to their account and demands they complete a manual reverse dial code, which actually withdraws money from the victim's account.",
    operator: "MTN",
    reportedCount: 24,
    dateReported: "2026-06-22"
  },
  "256701889922": {
    number: "256701889922",
    originalFormat: "+256 701 889 922",
    status: "SCAM",
    reason: "Airtel Support Impersonation. Scammer poses as an Airtel Customer Care agent telling the customer that their SIM card registration is incomplete or blocked. They demand the user's MoMo PIN or OTP to 'upgrade' the registration.",
    operator: "Airtel",
    reportedCount: 19,
    dateReported: "2026-06-23"
  },
  "256778443311": {
    number: "256778443311",
    originalFormat: "+256 778 443 311",
    status: "SCAM",
    reason: "Fake Lottery & Promo Fraud. Sends bulk SMS alerts stating: 'Congratulations! You have won 3,500,000 UGX in the Kampala Golden Promo.' When called, they demand a 'clearing fee' or tax of 45,000 UGX sent via MoMo before payout.",
    operator: "MTN",
    reportedCount: 42,
    dateReported: "2026-06-20"
  },
  "256752332211": {
    number: "256752332211",
    originalFormat: "+256 752 332 211",
    status: "SCAM",
    reason: "Wewole / Quick Loans Broker Scam. Promotes quick unsecured loans on social media. Demands a upfront registration fee of 30,000 UGX to process the loan, then blocks the applicant immediately after receiving the MoMo transfer.",
    operator: "Airtel",
    reportedCount: 15,
    dateReported: "2026-06-21"
  },
  "256782998877": {
    number: "256782998877",
    originalFormat: "+256 782 998 877",
    status: "SCAM",
    reason: "Urgent School Emergency Scam. Poses as a teacher or headmaster calling parents in Uganda, claiming their child has had a severe accident at school and requires immediate MoMo money for medical operations at a nearby clinic.",
    operator: "MTN",
    reportedCount: 31,
    dateReported: "2026-06-24"
  },

  // --- 4 WARNING NUMBERS ---
  "256775556677": {
    number: "256775556677",
    originalFormat: "+256 775 556 677",
    status: "WARNING",
    reason: "Suspicious Unsolicited Romance & Distress Calls. High frequency of calls requesting rapid, small-value MoMo transfers for 'transport to Kampala' with shifting explanations.",
    operator: "MTN",
    reportedCount: 5,
    dateReported: "2026-06-18"
  },
  "256704112233": {
    number: "256704112233",
    originalFormat: "+256 704 112 233",
    status: "WARNING",
    reason: "Wakiso High-Pressure Land Deposit Agent. Aggressive sales agents pushing quick land-title validation and demanding partial deposits on MoMo prior to physical visits. Unverified business practice.",
    operator: "Airtel",
    reportedCount: 3,
    dateReported: "2026-06-19"
  },
  "256781223344": {
    number: "256781223344",
    originalFormat: "+256 781 223 344",
    status: "WARNING",
    reason: "Kampala Job Placement Agency Coordinator. Reports of recruiting agents requesting a 'medical screening fee' of 25,000 UGX via MoMo before disclosing job interview locations.",
    operator: "MTN",
    reportedCount: 7,
    dateReported: "2026-06-23"
  },
  "256755887766": {
    number: "256755887766",
    originalFormat: "+256 755 887 766",
    status: "WARNING",
    reason: "Community Flag: Fake Bank Transfer SMS Agent. Suspect sends custom SMS alerts formatted as bank deposits to vendors (e.g. supermarkets) and leaves with goods before actual confirmation clears.",
    operator: "Airtel",
    reportedCount: 4,
    dateReported: "2026-06-15"
  },

  // --- 31 SAFE NUMBERS ---
  "256772123456": {
    number: "256772123456",
    originalFormat: "+256 772 123 456",
    status: "SAFE",
    reason: "Verified Personal Mobile Money User. This number has a highly active, positive transaction history with no reports of fraudulent or suspicious activity in Kampala.",
    operator: "MTN"
  },
  "256772987654": {
    number: "256772987654",
    originalFormat: "+256 772 987 654",
    status: "SAFE",
    reason: "Verified Local Business Wallet. Registered with certified commercial credentials and operating legally with clean history in Entebbe.",
    operator: "MTN"
  },
  "256703111222": {
    number: "256703111222",
    originalFormat: "+256 703 111 222",
    status: "SAFE",
    reason: "Verified Airtel Money Merchant (Duka). This is a registered local agent in Jinja with active KYC and fully compliant business operations.",
    operator: "Airtel"
  },
  "256751999888": {
    number: "256751999888",
    originalFormat: "+256 751 999 888",
    status: "SAFE",
    reason: "Verified Personal Wallet. Active MoMo user with positive rating and no registered complaints across Ugandan telecoms.",
    operator: "Airtel"
  },
  "256772456789": {
    number: "256772456789",
    originalFormat: "+256 772 456 789",
    status: "SAFE",
    reason: "Verified Agricultural Supply Wallet. Registered under national farming co-operatives in Mbarara. Clean and trusted merchant.",
    operator: "MTN"
  },
  "256701555444": {
    number: "256701555444",
    originalFormat: "+256 701 555 444",
    status: "SAFE",
    reason: "Verified Personal User. Clean operational history, verified registration under NIRA national database standards.",
    operator: "Airtel"
  },
  "256752666777": {
    number: "256752666777",
    originalFormat: "+256 752 666 777",
    status: "SAFE",
    reason: "Verified Boda-Boda Association Cashbox. Registered and managed under authorized Kampala urban transport units.",
    operator: "Airtel"
  },
  "256776111333": {
    number: "256776111333",
    originalFormat: "+256 776 111 333",
    status: "SAFE",
    reason: "Verified MTN MoMo Agent Booth. Highly active agent located in Wandegeya, Kampala. Verified and licensed.",
    operator: "MTN"
  },
  "256781222555": {
    number: "256781222555",
    originalFormat: "+256 781 222 555",
    status: "SAFE",
    reason: "Verified Personal User. No security issues logged, active user since 2018 under compliant registration.",
    operator: "MTN"
  },
  "256704999111": {
    number: "256704999111",
    originalFormat: "+256 704 999 111",
    status: "SAFE",
    reason: "Verified Airtel Money Merchant. Small scale vendor in Gulu. Active business and fully authorized.",
    operator: "Airtel"
  },
  "256759000222": {
    number: "256759000222",
    originalFormat: "+256 759 000 222",
    status: "SAFE",
    reason: "Verified Personal User. Registered national ID has been vetted. Safe to send money to.",
    operator: "Airtel"
  },
  "256772777111": {
    number: "256772777111",
    originalFormat: "+256 772 777 111",
    status: "SAFE",
    reason: "Verified Local Clinic Pharmacy Wallet. Authorized collection point for medicine purchases in Mukono.",
    operator: "MTN"
  },
  "256773888444": {
    number: "256773888444",
    originalFormat: "+256 773 888 444",
    status: "SAFE",
    reason: "Verified Hardware Store Paybill. Trusted dealer operating legally in Ntinda, Kampala. No registered complaints.",
    operator: "MTN"
  },
  "256701123789": {
    number: "256701123789",
    originalFormat: "+256 701 123 789",
    status: "SAFE",
    reason: "Verified School Fees Collection Wallet. Certified and managed officially by local Ugandan high school in Wakiso.",
    operator: "Airtel"
  },
  "256757654321": {
    number: "256757654321",
    originalFormat: "+256 757 654 321",
    status: "SAFE",
    reason: "Verified Personal Wallet. Active user with positive ratings. Registered under verified Ugandan national identity.",
    operator: "Airtel"
  },
  "256774999888": {
    number: "256774999888",
    originalFormat: "+256 774 999 888",
    status: "SAFE",
    reason: "Verified Community SACCO Wallet. Trusted savings and co-operative wallet based in Lira.",
    operator: "MTN"
  },
  "256782444555": {
    number: "256782444555",
    originalFormat: "+256 782 444 555",
    status: "SAFE",
    reason: "Verified Academic Tutor wallet. Certified payment account for university preparation lessons in Makerere.",
    operator: "MTN"
  },
  "256702999333": {
    number: "256702999333",
    originalFormat: "+256 702 999 333",
    status: "SAFE",
    reason: "Verified Retail Shop Wallet. Small retail supermarket located in Rubaga, Kampala. Trusted merchant.",
    operator: "Airtel"
  },
  "256753111444": {
    number: "256753111444",
    originalFormat: "+256 753 111 444",
    status: "SAFE",
    reason: "Verified Personal User. This account is validated and has a pristine record for peer-to-peer transfers.",
    operator: "Airtel"
  },
  "256772666222": {
    number: "256772666222",
    originalFormat: "+256 772 666 222",
    status: "SAFE",
    reason: "Verified Wholesale Grocery Distributor. Official supplier wallet in Kikuubo commercial hub, Kampala.",
    operator: "MTN"
  },
  "256779333555": {
    number: "256779333555",
    originalFormat: "+256 779 333 555",
    status: "SAFE",
    reason: "Verified Personal Wallet. Checked against recent telecom reports; has 100% clean safety index.",
    operator: "MTN"
  },
  "256705444666": {
    number: "256705444666",
    originalFormat: "+256 705 444 666",
    status: "SAFE",
    reason: "Verified Airtel Agent. Active kiosk operating in Masaka town center, vetted with regular compliance checks.",
    operator: "Airtel"
  },
  "256754555777": {
    number: "256754555777",
    originalFormat: "+256 754 555 777",
    status: "SAFE",
    reason: "Verified Personal Wallet. Reliable transaction history, no warnings, registered to verified citizen.",
    operator: "Airtel"
  },
  "256778111222": {
    number: "256778111222",
    originalFormat: "+256 778 111 222",
    status: "SAFE",
    reason: "Verified Agri-Business Coffee Merchant. Trade payment point for organic growers in Mbale.",
    operator: "MTN"
  },
  "256783999000": {
    number: "256783999000",
    originalFormat: "+256 783 999 000",
    status: "SAFE",
    reason: "Verified Personal User. Clean and consistent history of utility payments and airtime purchases.",
    operator: "MTN"
  },
  "256706111777": {
    number: "256706111777",
    originalFormat: "+256 706 111 777",
    status: "SAFE",
    reason: "Verified Airtel Retail Shop Agent. Vetted dealer wallet inside Acacia Mall, Kampala.",
    operator: "Airtel"
  },
  "256758222999": {
    number: "256758222999",
    originalFormat: "+256 758 222 999",
    status: "SAFE",
    reason: "Verified Transport Agency Cashier. Active payments collection point for long-distance buses to Fort Portal.",
    operator: "Airtel"
  },
  "256772888222": {
    number: "256772888222",
    originalFormat: "+256 772 888 222",
    status: "SAFE",
    reason: "Verified Bookshop and Stationary Merchant. Trusted store in Kampala CBD near Uganda Bookshop.",
    operator: "MTN"
  },
  "256773555111": {
    number: "256773555111",
    originalFormat: "+256 773 555 111",
    status: "SAFE",
    reason: "Verified Personal Wallet. Active and safe, clean records with no suspicious high-frequency inward transfers.",
    operator: "MTN"
  },
  "256703555999": {
    number: "256703555999",
    originalFormat: "+256 703 555 999",
    status: "SAFE",
    reason: "Verified Local Restaurant Paybill. Standard merchant wallet for food sales in Naalya, Kampala.",
    operator: "Airtel"
  },
  "256751222888": {
    number: "256751222888",
    originalFormat: "+256 751 222 888",
    status: "SAFE",
    reason: "Verified Personal User. Checked compliant on KYC; highly reliable for peer-to-peer transfers.",
    operator: "Airtel"
  }
};
