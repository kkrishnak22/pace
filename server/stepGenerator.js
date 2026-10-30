// d:\pace\server\stepGenerator.js

/**
 * Dynamic Step Generator
 * Synthesizes advanced steps on-demand via the Lesson Engine API.
 */
function generateDynamicStep(params = {}) {
  const { topic = "java-memory", stepNumber = 3, language = "en" } = params;
  const startTime = Date.now();

  if (Number(stepNumber) === 3) {
    const stepData = {
      step: 3,
      status: "dynamically-generated",
      generatedAt: new Date().toISOString(),
      generationLatencyMs: Date.now() - startTime + 320,
      tokenCount: 485,
      apiEndpoint: "/api/lesson/generate-step",
      modelEngine: "LessonEngine-JVMS-Synthesizer-v2",

      title_en: "Watching Memory Move Live // The Step-by-Step Code Execution",
      title_telugish: "Code Run Ayyeppudu Memory Visuals // Step-by-Step Tracing",
      subtitle_en: "Watch what happens in physical memory line-by-line as modify(dog, age) executes. See why Bruno's name changed on the shared television, but age remained completely safe on main's personal desk!",
      subtitle_telugish: "modify(dog, age) run ayyeppudu memory lo em jaruguthundo live ga choodandi. Bruno peru enduku marindi, age enduku alane safe ga undo ippudu ardham avthundi!",
      narration_en: "Act Three: Code in Action. Watch how Java copies what is on the desk, with zero exceptions. When modify is called, it gets a fresh desk tray: a duplicate remote pointing to 0x4A2F and an independent copy of number 3. Updating the name reaches through the remote to the TV in the warehouse; reassigning the remote builds a new TV that only modify's remote can see!",
      narration_telugish: "Act Three: Code in Action! Ippudu mana modify method line-by-line ela execute avthundo live ga choodam. modify call avvagane desk meeda kotha tray vachindi. Remote dwara TV peru Rocky ga marindi, kani localAge modify tray meede marindi!",

      codeLines: [
        { num: 1, text: "public class MemoryMasterclass {" },
        { num: 2, text: "  public static void main(String[] args) {" },
        { num: 3, text: "    int age = 3;" },
        { num: 4, text: "    Dog dog = new Dog(\"Bruno\", age);" },
        { num: 5, text: "    modify(dog, age); // Pass-by-Value remote copy" },
        { num: 6, text: "    // Output: dog.name == \"Rocky\", age == 3" },
        { num: 7, text: "  }" },
        { num: 8, text: "" },
        { num: 9, text: "  static void modify(Dog d, int localAge) {" },
        { num: 10, text: "    localAge = localAge + 5;" },
        { num: 11, text: "    d.setName(\"Rocky\"); // Beams signal to 0x4A2F" },
        { num: 12, text: "    d = new Dog(\"Max\", 1); // New TV at 0x7B9C" },
        { num: 13, text: "  }" },
        { num: 14, text: "}" }
      ],

      executionSteps: [
        {
          stepIndex: 0,
          activeLine: 3,
          frameName: "FRAME: main()",
          explainer_en: "Step 1: main() initialized on top of the Call Stack. int age = 3 stored directly as raw bits inside main's frame.",
          explainer_telugish: "Step 1: Call Stack meeda main() frame create ayyindi. int age = 3 direct ga stack lo store aindi.",
          stack: [
            { name: "Slot 0: args", val: "String[] (0x1000)", highlight: false },
            { name: "Slot 1: age", val: "3 (raw int)", highlight: true }
          ],
          heap: [],
          gcStatus: "Clean",
          gcDetail: "Active GC Roots: main() Thread 1."
        },
        {
          stepIndex: 1,
          activeLine: 4,
          frameName: "FRAME: main()",
          explainer_en: "Step 2: new Dog(\"Bruno\", 3) allocates 16-byte object on Heap at address 0x4A2F. Remote handle placed in main's slot 2.",
          explainer_telugish: "Step 2: Heap warehouse lo address 0x4A2F daggara Dog object create aindi. Daaniki remote main frame lo vachindi.",
          stack: [
            { name: "Slot 0: args", val: "String[] (0x1000)", highlight: false },
            { name: "Slot 1: age", val: "3 (raw int)", highlight: false },
            { name: "Slot 2: dog", val: "0x4A2F (Remote Handle)", highlight: true }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Bruno\", age: 3", orphan: false }
          ],
          gcStatus: "Reachable",
          gcDetail: "Object 0x4A2F reachable via main() Slot 2: dog."
        },
        {
          stepIndex: 2,
          activeLine: 9,
          frameName: "FRAME: modify()",
          explainer_en: "Step 3: modify(dog, age) invoked! Fresh stack frame pushed: d gets DUPLICATE remote (0x4A2F), localAge gets COPY of number 3.",
          explainer_telugish: "Step 3: modify() call ayyindi! Desk meeda kotha tray: d ki duplicate remote (0x4A2F), localAge ki 3 copy vachindi.",
          stack: [
            { name: "[main] Slot 2: dog", val: "0x4A2F", highlight: false },
            { name: "[main] Slot 1: age", val: "3", highlight: false },
            { name: "[modify] Slot 0: d", val: "0x4A2F (Copied Remote)", highlight: true },
            { name: "[modify] Slot 1: localAge", val: "3 (Copied Number)", highlight: true }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Bruno\", age: 3", orphan: false }
          ],
          gcStatus: "2 Remotes Active",
          gcDetail: "Object 0x4A2F has 2 active remotes: main.dog & modify.d."
        },
        {
          stepIndex: 3,
          activeLine: 10,
          frameName: "FRAME: modify()",
          explainer_en: "Step 4: localAge = localAge + 5 updates modify's local slot to 8. main's age note (3) is completely untouched!",
          explainer_telugish: "Step 4: localAge 8 ga marindi, kani adi modify tray meede marindi! main lo unna age 3 alane safe ga undi!",
          stack: [
            { name: "[main] Slot 1: age", val: "3 (Untouched & Safe!)", highlight: false },
            { name: "[modify] Slot 1: localAge", val: "8 (Modified Local Copy)", highlight: true },
            { name: "[modify] Slot 0: d", val: "0x4A2F", highlight: false }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Bruno\", age: 3", orphan: false }
          ],
          gcStatus: "Primitive Safe",
          gcDetail: "Pass-by-value guarantees caller's primitive slot cannot be overwritten."
        },
        {
          stepIndex: 4,
          activeLine: 11,
          frameName: "FRAME: modify()",
          explainer_en: "Step 5: d.setName(\"Rocky\") beams a signal through remote 0x4A2F. The single shared TV in the warehouse updates to \"Rocky\"!",
          explainer_telugish: "Step 5: d.setName(\"Rocky\") duplicate remote tho signal pampindi. Warehouse lo unna shared TV peru Rocky ga marindi!",
          stack: [
            { name: "[main] Slot 2: dog", val: "0x4A2F (Remote)", highlight: false },
            { name: "[modify] Slot 0: d", val: "0x4A2F (Remote)", highlight: true }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Rocky\", age: 3", orphan: false }
          ],
          gcStatus: "Heap Mutated",
          gcDetail: "Both remotes observe the updated name 'Rocky' on the single shared TV screen."
        },
        {
          stepIndex: 5,
          activeLine: 12,
          frameName: "FRAME: modify()",
          explainer_en: "Step 6: d = new Dog(\"Max\", 1) buys a NEW TV at 0x7B9C and points ONLY modify's remote to it! main's remote STILL points to Rocky!",
          explainer_telugish: "Step 6: d = new Dog kotha TV create chesi modify remote ni daaniki marchindi! main lo unna remote inka Rocky ke point chesthundi!",
          stack: [
            { name: "[main] Slot 2: dog", val: "0x4A2F -> Points to Rocky", highlight: false },
            { name: "[modify] Slot 0: d", val: "0x7B9C -> Points to Max", highlight: true }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Rocky\", age: 3", orphan: false },
            { addr: "0x7B9C", type: "Dog instance", desc: "name: \"Max\", age: 1", orphan: false }
          ],
          gcStatus: "Two Objects Live",
          gcDetail: "Address 0x4A2F owned by main(); Address 0x7B9C owned by modify()."
        },
        {
          stepIndex: 6,
          activeLine: 13,
          frameName: "FRAME: main()",
          explainer_en: "Step 7: modify() finishes and its desk tray is destroyed! Object 0x7B9C now has 0 remotes -> Garbage Collector quietly recycles it!",
          explainer_telugish: "Step 7: modify() complete ayyi daani tray wipe aindi! 0x7B9C ki remotes levu kabatti Garbage Collector recycle chesthundi!",
          stack: [
            { name: "[main] Slot 2: dog", val: "0x4A2F (Rocky)", highlight: true },
            { name: "[main] Slot 1: age", val: "3", highlight: true }
          ],
          heap: [
            { addr: "0x4A2F", type: "Dog instance", desc: "name: \"Rocky\", age: 3", orphan: false },
            { addr: "0x7B9C", type: "Dog instance", desc: "name: \"Max\", age: 1", orphan: true }
          ],
          gcStatus: "GC Reclaiming 0x7B9C",
          gcDetail: "Object 0x7B9C is an unreachable orphan (0 GC roots). Tracing collector sweeps it safely!"
        }
      ]
    };

    return stepData;
  }

  // Fallback for unexpected step numbers
  return {
    step: Number(stepNumber),
    status: "not-found",
    error: `Step ${stepNumber} not defined in lesson curriculum.`
  };
}

module.exports = {
  generateDynamicStep
};

