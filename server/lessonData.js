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
      title_en: "Step 1: Where Does Your Code Actually Live?",
      title_telugish: "Step 1: Mana Code Memory Lo Ekkada Untundi?",
      status: "preloaded",
      durationSec: 22
    },
    {
      step: 2,
      title_en: "Step 2: The TV Remote Secret (Mental Model)",
      title_telugish: "Step 2: TV Remote Rahasyam (Mental Model)",
      status: "preloaded",
      durationSec: 24
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
    title_en: "Where Does Your Code Actually Live? // The Mystery of Computer Memory",
    title_telugish: "Mana Code Memory Lo Ekkada Untundi? // Computer Memory Rahasyam",
    subtitle_en: "When you write code and click Run, magic happens behind the screen. But where do your variables and objects actually live? Let's take a journey into the two rooms every programmer must know!",
    subtitle_telugish: "Manam code rasi Run kottinappudu variables ekkada untayo telusa? Prathi software engineer telusukovalsina rendu special rooms ippudu choodam!",
    narration_en: "Welcome! Whenever you write code and click Run, where does your data actually sleep and wake up? Let's take a journey into the two rooms every programmer must know.",
    narration_telugish: "Swagatham ra mawa! Manam code rasi Run kottinappudu variables ekkada untayo telusa? Prathi software engineer telusukovalsina rendu special rooms ippudu choodam!",
    cards: [
      {
        id: "room-desk",
        badge: "ROOM 1 // THE STACK",
        title_en: "The Quick Desk (Stack)",
        title_telugish: "Quick Study Desk (Stack)",
        desc_en: "Fast, personal scratchpad. Every method call gets its own neat tray. The instant the method finishes—BAM! The tray is recycled in 0.001 milliseconds with zero waste!",
        desc_telugish: "Mana personal study desk lanti dhi. Chala fast! Method run avvagane oka tray vasthundi. Method pani aipovagane aa tray ni ventane clean chesestharu!"
      },
      {
        id: "room-warehouse",
        badge: "ROOM 2 // THE HEAP",
        title_en: "The Big Warehouse (Heap)",
        title_telugish: "Pedda Shared Warehouse (Heap)",
        desc_en: "Spacious shared storage for big items. When you type 'new', an object is placed on a warehouse shelf. It stays alive as long as anyone holds a receipt for it!",
        desc_telugish: "Pedda storage room. Objects anni ikkade untayi. Vatiki receipt unnantha varaku safe ga untayi!"
      }
    ],
    puzzle: {
      badge: "THE 30-SECOND MYSTERY",
      code: "Dog dog = new Dog(\"Bruno\", 3);\nmodify(dog, age); // What happens to Bruno's name and age?",
      question_en: "After modify() runs, Bruno's name changes to 'Max', but his age stays 3! Why did one change while the other stayed safe?",
      question_telugish: "modify method loki dog mariyu age ni pampithe, peru marindi kani age maaraledhu! Dheeni venaka unna secret ippudu choodam!",
      hint_en: "Variables are TV remotes, not the television. Let's see Step 2!",
      hint_telugish: "Variables ante TV remotes, objects ante TV lu. Step 2 lo choodam!"
    }
  },

  2: {
    step: 2,
    title_en: "The TV Remote Secret // The Golden Mental Model",
    title_telugish: "TV Remote Rahasyam // Golden Mental Model",
    subtitle_en: "The single biggest breakthrough in Java: The variable is NOT the object. The variable is a TV remote control; the object is the 65-inch television sitting in the warehouse!",
    subtitle_telugish: "Java lo eppudu gurthupettuko: variable lo object undadu ra thammudu! Adi kevalam 0x4A2F address unna TV Remote Control anthe!",
    narration_en: "Act Two: The TV Remote Secret. Your variable does NOT hold the dog! It is just a TV remote control dialed into address 0x4A2F. Writing Dog d2 = dog does not buy a second TV; it simply makes a second remote control pointed at the exact same television!",
    narration_telugish: "Act Two: TV Remote Secret! Variable lo object undadu ra thammudu! Adi kevalam 0x4A2F address unna TV Remote Control anthe! Dog d2 = dog anagane kotha TV raledhu, second remote vachindi!",
    remote1: {
      id: "remote-s1",
      name: "Remote: dog (s1)",
      freq: "Freq: 0x4A2F",
      decl: "Dog dog = new Dog(\"Bruno\", 3);"
    },
    remote2: {
      id: "remote-s2",
      name: "Remote: d2 (s2)",
      freq: "Freq: 0x4A2F",
      decl: "Dog d2 = dog; // Copied Remote Pointer"
    },
    tv: {
      id: "tv-alice",
      label: "Smart TV in Warehouse",
      address: "Address: 0x4A2F",
      name: "Bruno",
      age: 3
    },
    goldenAnchor_en: "Golden Mental Anchor: Dog d2 = dog; did NOT buy a second television! It manufactured a second remote control tuned to the identical physical TV screen. That is Aliasing!",
    goldenAnchor_telugish: "Golden Secret: Dog d2 = dog; kotha TV konaledhu mawa! Same TV ki inkoka duplicate remote tayaru chesam anthe. Rendu remotes oke TV ni control chesthunnayi!"
  }
};

module.exports = {
  lessonManifest,
  preloadedSteps
};

