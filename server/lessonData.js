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
      title_en: "Step 1: The Two Rooms of Memory (Stack vs. Heap)",
      title_telugish: "Step 1: Memory Lo Rendu Mukhyamaina Rooms (Stack vs. Heap)",
      status: "preloaded",
      durationSec: 25
    },
    {
      step: 2,
      title_en: "Step 2: The TV Remote Secret (Mental Model)",
      title_telugish: "Step 2: TV Remote Rahasyam (Mental Model)",
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
    title_en: "Where Does Your Code Actually Live? // The Two Rooms of Memory",
    title_telugish: "Mana Code Memory Lo Ekkada Untundi? // Memory Lo Rendu Mukhyamaina Rooms",
    subtitle_en: "Whenever you write Java code, your computer divides memory into two distinct rooms: Room 1 (The Stack Desk) and Room 2 (The Heap Warehouse).",
    subtitle_telugish: "Manam Java code rasi Run kottinappudu computer RAM rendu mukhyamaina rooms ga vibhajincha baduthundi: Room 1 (Stack Desk) mariyu Room 2 (Heap Warehouse).",
    
    // Direct 1-to-1 sync with screen text: No disconnected greetings!
    narration_en: "Where does your Java code actually live? When you click Run, Java divides your computer's RAM into two distinct rooms. Look on the left: Room 1 is the Stack, your quick study desk. It holds local primitive variables like age, and remote pointers like dog. It is ultra-fast, allocated in 0.001 milliseconds, and cleared the instant your method ends. Look on the right: Room 2 is the Heap, the big shared warehouse. Every object built with 'new' gets a shelf here, living safely as long as someone has a remote control for it. Now look at our 30-Second Mystery at the bottom: When you write Dog dog = new Dog(), where does each part live? The variable 'dog' sits on the Stack desk, while the actual 'Dog' object lives in the Heap warehouse!",
    
    narration_telugish: "Mana Java code memory lo ekkada untundi? Manam Run kottinappudu Java mana RAM ni rendu rooms ga divide chesthundi. Left side choodandi: Room 1 mana Stack, ante quick study desk. Dheeni meeda age lanti local variables mariyu dog lanti remote pointers untayi. Chala fast, method aipovagane 0.001 millisecond lo clean aipothundi. Right side choodandi: Room 2 mana Heap, ante pedda shared warehouse. 'new' keyword tho build chesina objects anni ikkade shelves meeda untayi. Kindha unna 30-Second Mystery choodandi: Dog dog = new Dog() annappudu edi ekkada untundi? Variable 'dog' Stack desk meeda untundi, physical 'Dog' object matram Heap warehouse lo shelf meeda untundi!",

    cards: [
      {
        id: "room-desk",
        badge: "ROOM 1 // THE STACK",
        topicKey: "stack-memory",
        title_en: "Room 1: The Stack (Your Quick Desk)",
        title_telugish: "Room 1: The Stack (Quick Study Desk)",
        desc_en: "Your personal study desk. Holds temporary local variables (int age = 21) and remote pointers (dog = 0x4A2F). Ultra-fast (0.001ms), cleared instantly when your method ends!",
        desc_telugish: "Mana personal study desk lanti dhi. Local variables (int age = 21) mariyu remote pointers (dog = 0x4A2F) ikkade untayi. Chala fast (0.001ms), method finish avvagane clean aipothundi!",
        stats: "⚡ Speed: 0.001ms • 🧹 Cleanup: Automatic LIFO • 📦 Stores: Primitives & Reference Addresses",
        ramDetails_en: "Physical RAM: Fast CPU Cache & Thread Stack. Managed by RSP Register. If full: StackOverflowError.",
        ramDetails_telugish: "Physical RAM: Fast CPU Cache & Thread Stack. RSP Register manage chesthundi. Full aithe: StackOverflowError."
      },
      {
        id: "room-warehouse",
        badge: "ROOM 2 // THE HEAP",
        topicKey: "heap-memory",
        title_en: "Room 2: The Heap (The Big Warehouse)",
        title_telugish: "Room 2: The Heap (Pedda Shared Warehouse)",
        desc_en: "The spacious shared warehouse. Every object built with 'new Dog(\"Bruno\", 3)' gets a shelf here. Lives safely as long as any remote on your desk points to it!",
        desc_telugish: "Pedda shared warehouse. 'new Dog(\"Bruno\", 3)' tho build chesina objects anni ikkade shelves meeda untayi. Desk meeda unna remote point chesthunnantha varaku safe ga untundi!",
        stats: "🏢 Capacity: Global JVM Shared • 🤖 Managed by: Garbage Collector • 📦 Stores: All Object Instances",
        ramDetails_en: "Physical RAM: Shared Global Memory Pool. Managed by Garbage Collector. If full: OutOfMemoryError.",
        ramDetails_telugish: "Physical RAM: Shared Global Memory Pool. Garbage Collector manage chesthundi. Full aithe: OutOfMemoryError."
      }
    ],

    puzzle: {
      badge: "THE 30-SECOND INTERVIEW MYSTERY",
      topicKey: "mystery-puzzle",
      code: "Dog dog = new Dog(\"Bruno\", 3);\n// Question: Where does the variable live? Where does the object live?",
      question_en: "When you write Dog dog = new Dog(\"Bruno\", 3); — which room holds the variable 'dog', and which room holds the physical 'Dog' object?",
      question_telugish: "Dog dog = new Dog(\"Bruno\", 3); annappudu, variable 'dog' ekkada untundi? Physical 'Dog' object ekkada untundi?",
      answer_en: "ANSWER: The variable 'dog' sits on your Quick Desk (Stack) holding address 0x4A2F. The actual Dog object lives in the Big Warehouse (Heap) on shelf 0x4A2F!",
      answer_telugish: "ANSWER: Variable 'dog' Stack desk meeda remote la untundi (0x4A2F). Physical Dog object Heap warehouse lo shelf meeda untundi!"
    }
  },

  2: {
    step: 2,
    title_en: "The TV Remote Secret // The Golden Mental Model",
    title_telugish: "TV Remote Rahasyam // Golden Mental Model",
    subtitle_en: "The single biggest breakthrough in Java: The variable is NOT the object. The variable is a TV remote control; the object is the smart television sitting in the warehouse!",
    subtitle_telugish: "Java lo eppudu gurthupettuko: variable lo object undadu ra thammudu! Adi kevalam 0x4A2F address unna TV Remote Control anthe!",
    
    // Direct 1-to-1 sync with screen text
    narration_en: "Step 2: The TV Remote Secret! In Java, an object variable never holds the real object. Instead, look at Remote 1 on the left: it is just a TV remote control tuned to frequency code 0x4A2F. On the right, look at the Smart TV: this is the real Dog object resting in the Warehouse at memory address 0x4A2F. Now, what happens when you write Dog d2 = dog? Watch closely: you did not buy a second television! You simply picked up a second remote control tuned to the exact same TV. That is called Aliasing. Remember our Golden Anchor: Java is always strictly pass-by-value. But the value being passed is always the remote control's frequency code, never the TV itself!",
    
    narration_telugish: "Step 2: TV Remote Rahasyam! Java lo variable lo eppudu real object undadu. Left side unna Remote 1 choodandi: adi kevalam 0x4A2F frequency unna TV Remote Control anthe. Right side Smart TV choodandi: adi Heap warehouse lo 0x4A2F address daggara unna real Dog object. Ippudu Dog d2 = dog annappudu em jaruguthundi? Kotha TV raledhu! Same TV ki second remote vachindi. Dheenne Aliasing antaru. Java lo eppudu Pass-by-Value eh jaruguthundi: TV maaradu, remote frequency number copy avthundi anthe!",

    remote1: {
      id: "remote-s1",
      topicKey: "tv-remote",
      name: "Remote 1: dog",
      freq: "Freq: 0x4A2F",
      decl: "Dog dog = new Dog(\"Bruno\", 3);"
    },
    remote2: {
      id: "remote-s2",
      topicKey: "aliasing",
      name: "Remote 2: d2",
      freq: "Freq: 0x4A2F",
      decl: "Dog d2 = dog; // Duplicate Remote Control"
    },
    tv: {
      id: "tv-alice",
      topicKey: "memory-address",
      label: "Smart TV in Warehouse",
      address: "Address: 0x4A2F",
      name: "Bruno",
      age: 3
    },
    goldenAnchor_en: "Golden Rule: Dog d2 = dog; did NOT buy a second television! It manufactured a second remote control tuned to the identical physical TV screen. That is Aliasing!",
    goldenAnchor_telugish: "Golden Secret: Dog d2 = dog; kotha TV konaledhu mawa! Same TV ki inkoka duplicate remote tayaru chesam anthe. Rendu remotes oke TV ni control chesthunnayi!"
  }
};

module.exports = {
  lessonManifest,
  preloadedSteps
};
