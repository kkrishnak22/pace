// d:\pace\server\lessonData.js

const lessonManifest = {
  id: "java-memory-architecture",
  title_en: "Java Memory Architecture: Stack vs. Heap & Pass-by-Value",
  title_telugish: "Java Memory Architecture: Stack mariyu Heap Rahasyam",
  topic: "Stack vs. Heap Memory & Object References in Java",
  curriculum: "JNTUH CSE II-I CS305PC & Senior Technical Interview Standards",
  totalSteps: 3,
  stepsSummary: [
    {
      step: 1,
      title_en: "Step 1: The Two Rooms of Memory (Stack Desk vs. Heap Vault)",
      title_telugish: "Step 1: Memory Lo Rendu Mukhyamaina Rooms (Stack vs. Heap)",
      status: "preloaded",
      durationSec: 25
    },
    {
      step: 2,
      title_en: "Step 2: The Debit Card Secret (Aliasing & Joint Accounts)",
      title_telugish: "Step 2: Debit Card Rahasyam (Aliasing & Joint Accounts)",
      status: "preloaded",
      durationSec: 25
    },
    {
      step: 3,
      title_en: "Step 3: Watching Memory Move Live (JVMS Execution Trace)",
      title_telugish: "Step 3: Code Run Ayyeppudu Memory Visuals (JVMS Tracing)",
      status: "on-demand-api",
      durationSec: 26
    }
  ]
};

const preloadedSteps = {
  1: {
    step: 1,
    title_en: "Where Does Your Code Actually Live? // The Two Realms of Memory",
    title_telugish: "Mana Code Memory Lo Ekkada Untundi? // Memory Lo Rendu Mukhyamaina Realms",
    subtitle_en: "Whenever you write Java code, your computer divides memory into two distinct realms: Room 1 (The Stack Execution Desk) and Room 2 (The Central Bank Vault on the Heap).",
    subtitle_telugish: "Manam Java code rasi Run kottinappudu computer RAM rendu mukhyamaina realms ga vibhajincha baduthundi: Room 1 (Stack Desk) mariyu Room 2 (Heap Central Vault).",
    
    // Direct 1-to-1 sync with screen text: Grounded in MIT 6.005 & Oracle Java Tutorials
    narration_en: "Where does your Java code actually live? When you click Run, Java divides your computer's RAM into two distinct rooms. Look on the left: Room 1 is the Stack, your quick study desk. It holds local primitive variables like deposit, and debit card pointers like account. It is ultra-fast, allocated in 0.001 milliseconds, and cleared the instant your method ends. Look on the right: Room 2 is the Heap, the big shared warehouse. Every object built with 'new' gets a shelf here, living safely as long as someone has a debit card for it. Now look at our 30-Second Mystery at the bottom: When you write BankAccount account = new BankAccount(), where does each part live? The variable 'account' sits on the Stack desk, while the actual 'BankAccount' object lives in the Heap warehouse!",
    
    narration_telugish: "Mana Java code memory lo ekkada untundi? Manam Run kottinappudu Java mana RAM ni rendu rooms ga divide chesthundi. Left side choodandi: Room 1 mana Stack, ante quick study desk. Dheeni meeda deposit lanti local variables mariyu account lanti debit card pointers untayi. Chala fast, method aipovagane 0.001 millisecond lo clean aipothundi. Right side choodandi: Room 2 mana Heap, ante pedda shared warehouse. 'new' keyword tho build chesina objects anni ikkade shelves meeda untayi. Kindha unna 30-Second Mystery choodandi: BankAccount account = new BankAccount() annappudu edi ekkada untundi? Variable 'account' Stack desk meeda untundi, physical 'BankAccount' object matram Heap warehouse lo shelf meeda untundi!",

    cards: [
      {
        id: "room-desk",
        badge: "ROOM 1 // THE STACK",
        topicKey: "stack-memory",
        title_en: "Room 1: The Stack (Your Quick Desk)",
        title_telugish: "Room 1: The Stack (Quick Study Desk)",
        desc_en: "Your personal study desk. Holds temporary local variables (int deposit = 500) and debit card references (account = 0x4A2F). Ultra-fast (0.001ms), cleared instantly when your method ends!",
        desc_telugish: "Mana personal study desk lanti dhi. Local variables (int deposit = 500) mariyu debit card references (account = 0x4A2F) ikkade untayi. Chala fast (0.001ms), method finish avvagane clean aipothundi!",
        stats: "⚡ Speed: 0.001ms • 🧹 Cleanup: Automatic LIFO • 📦 Stores: Primitives & Reference Addresses",
        ramDetails_en: "Physical RAM: Fast CPU Cache & Thread Stack. Managed by RSP Register. If full: StackOverflowError.",
        ramDetails_telugish: "Physical RAM: Fast CPU Cache & Thread Stack. RSP Register manage chesthundi. Full aithe: StackOverflowError."
      },
      {
        id: "room-warehouse",
        badge: "ROOM 2 // THE HEAP",
        topicKey: "heap-memory",
        title_en: "Room 2: The Heap (The Central Vault)",
        title_telugish: "Room 2: The Heap (Central Bank Vault)",
        desc_en: "The spacious shared vault. Every object built with 'new BankAccount(\"Alice\", 500)' gets a shelf here. Lives safely as long as any debit card in your wallet points to it!",
        desc_telugish: "Pedda shared central vault. 'new BankAccount(\"Alice\", 500)' tho build chesina objects anni ikkade shelves meeda untayi. Pocket lo unna card point chesthunnantha varaku safe ga untundi!",
        stats: "🏢 Capacity: Global JVM Shared • 🤖 Managed by: Garbage Collector • 📦 Stores: All Object Instances",
        ramDetails_en: "Physical RAM: Shared Global Memory Pool. Managed by Garbage Collector. If full: OutOfMemoryError.",
        ramDetails_telugish: "Physical RAM: Shared Global Memory Pool. Garbage Collector manage chesthundi. Full aithe: OutOfMemoryError."
      }
    ],

    puzzle: {
      badge: "THE 30-SECOND INTERVIEW MYSTERY",
      topicKey: "mystery-puzzle",
      code: "BankAccount account = new BankAccount(\"Alice\", 500);\n// Question: Where does the variable live? Where does the object live?",
      question_en: "When you write BankAccount account = new BankAccount(\"Alice\", 500); — which room holds the variable 'account', and which room holds the physical 'BankAccount' object?",
      question_telugish: "BankAccount account = new BankAccount(\"Alice\", 500); annappudu, variable 'account' ekkada untundi? Physical 'BankAccount' object ekkada untundi?",
      answer_en: "ANSWER: The variable 'account' sits on your Quick Desk (Stack) holding address 0x4A2F. The actual BankAccount object lives in the Central Vault (Heap) on shelf 0x4A2F!",
      answer_telugish: "ANSWER: Variable 'account' Stack desk meeda debit card la untundi (0x4A2F). Physical BankAccount object Heap vault lo shelf meeda untundi!"
    }
  },

  2: {
    step: 2,
    title_en: "The Debit Card Secret // Aliasing & Joint Accounts",
    title_telugish: "Debit Card Rahasyam // Aliasing & Joint Accounts",
    subtitle_en: "The single biggest breakthrough in Java: The variable is NOT the object. The variable is a debit card in your pocket; the object is the central bank vault sitting on the heap!",
    subtitle_telugish: "Java lo eppudu gurthupettuko: variable lo object undadu ra thammudu! Adi kevalam 0x4A2F address unna Debit Card anthe!",
    
    // Direct 1-to-1 sync with screen text: Grounded in MIT 6.005 & Cay Horstmann
    narration_en: "Step 2: The Debit Card Secret! In Java, an object variable never holds the real object. Look on the left: Debit Card 1 is just a plastic card in Alice's pocket embossed with account address 0x4A2F. On the right, look at the Central Bank Vault: this is the real BankAccount object resting in the Heap warehouse at memory address 0x4A2F, holding five hundred dollars. Now, what happens when you write BankAccount jointCard = account? Watch closely: the bank did NOT build a second vault! The bank simply issued a second debit card to Bob tuned to the exact same vault. That is called Aliasing. Remember our Golden Anchor: Java is always strictly pass-by-value. The value being passed is always the card's four-byte address, never the vault itself!",
    
    narration_telugish: "Step 2: Debit Card Rahasyam! Java lo variable lo eppudu physical object undadu. Left side unna Debit Card 1 choodandi: adi Alice pocket lo unna card, daani meeda 0x4A2F address undi. Right side unna Central Bank Vault choodandi: adi Heap warehouse lo 0x4A2F daggara unna real BankAccount object, daantlo five hundred dollars unnayi. Ippudu BankAccount jointCard = account annappudu em jaruguthundi? Kotha bank vault kattaledhu! Same vault ki Bob ki second debit card vachindi. Dheenne Aliasing antaru. Java lo eppudu Pass-by-Value eh jaruguthundi: Vault maaradu, card meeda unna 0x4A2F address copy avthundi anthe!",

    card1: {
      id: "card-alice",
      topicKey: "debit-card",
      name: "Debit Card 1: account",
      holder: "Alice",
      addr: "0x4A2F",
      freq: "Account: 0x4A2F",
      decl: "BankAccount account = new BankAccount(\"Alice\", 500);"
    },
    card2: {
      id: "card-bob",
      topicKey: "aliasing",
      name: "Debit Card 2: jointCard",
      holder: "Bob (Joint)",
      addr: "0x4A2F",
      freq: "Account: 0x4A2F",
      decl: "BankAccount jointCard = account; // Joint Card (Aliasing)"
    },
    vault: {
      id: "vault-alice",
      topicKey: "memory-address",
      label: "Central Bank Vault in Heap",
      address: "0x4A2F",
      owner: "Alice & Bob (Shared)",
      balance: 500
    },
    goldenAnchor_en: "Golden Rule: BankAccount jointCard = account; did NOT build a second bank vault! It issued a second debit card programmed with the identical vault address (0x4A2F). That is Aliasing!",
    goldenAnchor_telugish: "Golden Secret: BankAccount jointCard = account; kotha bank vault kattaledhu mawa! Same vault ki inkoka duplicate debit card tayaru chesam anthe. Rendu cards oke account balance ni control chesthunnayi!"
  }
};

module.exports = {
  lessonManifest,
  preloadedSteps
};
