import type { VisualizationData } from '../contracts';

// Owner-reviewed authored data. No execution, fetching or persistence metadata.
export const javascriptClosureLesson: VisualizationData = {
  type: 'ANIMATED_FLOW',
  schemaVersion: 1,
  title: 'How JavaScript Closures Remember Variables',
  textAlternative:
    'One call to makeCounter creates a lexical environment and initializes one count binding to 0. It creates and returns increment, which retains access to that environment after the outer call ends. The first counter call updates count to 1 and returns 1; the second updates the same binding to 2 and returns 2. Highlighted nodes and labelled connections identify each authored stage. All nodes are a conceptual overview, not simultaneous active stack frames.',
  nodes: [
    {
      id: 'make-counter',
      label: 'makeCounter call',
      description:
        'The outer call creates the environment, initializes count, creates increment and returns that function. It is finished after stage 3.',
    },
    {
      id: 'lexical-environment',
      label: 'Lexical environment',
      description:
        'The surrounding lexical environment remains accessible to increment after the outer call returns. This is not an active call-stack frame.',
    },
    {
      id: 'count-binding',
      label: 'count: same binding',
      description:
        'One binding: initialized to 0, updated to 1 on the first counter call and to 2 on the second. These are successive values, not three variables.',
    },
    {
      id: 'increment-function',
      label: 'increment / counter',
      description:
        'The returned function is created during makeCounter. counter references it; calling counter invokes increment with access to count.',
    },
    {
      id: 'first-result',
      label: 'First result: 1',
      description:
        'Stage 4 returns 1 and assigns it to first. This labelled result is part of the overview; it has not occurred in earlier stages.',
    },
    {
      id: 'second-result',
      label: 'Second result: 2',
      description:
        'Stage 5 returns 2 and assigns it to second. first remains 1. This labelled result has not occurred in earlier stages.',
    },
  ],
  edges: [
    {
      id: 'creates-environment',
      source: 'make-counter',
      target: 'lexical-environment',
      label: 'Creates environment',
    },
    {
      id: 'contains-count',
      source: 'lexical-environment',
      target: 'count-binding',
      label: 'Contains count binding',
    },
    {
      id: 'creates-returns',
      source: 'make-counter',
      target: 'increment-function',
      label: 'Creates and returns function',
    },
    {
      id: 'retains-access',
      source: 'increment-function',
      target: 'lexical-environment',
      label: 'Retains lexical access',
    },
    {
      id: 'updates-count',
      source: 'increment-function',
      target: 'count-binding',
      label: 'Reads and updates same binding',
    },
    {
      id: 'returns-first',
      source: 'increment-function',
      target: 'first-result',
      label: 'First call returns 1',
    },
    {
      id: 'returns-second',
      source: 'increment-function',
      target: 'second-result',
      label: 'Second call returns 2',
    },
  ],
  steps: [
    {
      title: 'Call makeCounter',
      explanation:
        'Calling makeCounter starts an outer function call with a new lexical environment. This diagram follows that one call and the function it will return. The count binding belongs to this environment; its initializer is the next stage. No counter result has been produced yet.',
      nodeIds: ['make-counter', 'lexical-environment'],
      edgeIds: ['creates-environment'],
    },
    {
      title: 'Initialize the count binding',
      explanation:
        'The statement let count = 0 initializes the count binding to 0. This is one mutable binding, not a separate copy for each later counter call. The outer function is still running at this stage.',
      nodeIds: ['lexical-environment', 'count-binding'],
      edgeIds: ['contains-count'],
    },
    {
      title: 'Create and return increment',
      explanation:
        'Evaluating the function expression creates increment with access to the surrounding lexical environment. The return statement returns that function without calling it, and counter receives the function reference. The makeCounter call now ends and its active call-stack frame is removed. The returned function still has access to count, which is 0; the closure does not keep the outer call actively running.',
      nodeIds: ['make-counter', 'increment-function', 'lexical-environment'],
      edgeIds: ['creates-returns', 'retains-access'],
    },
    {
      title: 'First counter() call: return 1',
      explanation:
        'Calling counter invokes the returned increment function. It reads the existing count binding, changes count from 0 to 1, and returns 1. The constant first receives 1. This increment call finishes, while the same count binding remains accessible through the returned function.',
      nodeIds: [
        'increment-function',
        'lexical-environment',
        'count-binding',
        'first-result',
      ],
      edgeIds: ['retains-access', 'updates-count', 'returns-first'],
    },
    {
      title: 'Second counter() call: return 2',
      explanation:
        'Calling counter again invokes the same returned function. It reads count as 1, changes count from 1 to 2, and returns 2. The constant second receives 2; first remains 1. This call does not run makeCounter again or reinitialize count to 0.',
      nodeIds: [
        'increment-function',
        'lexical-environment',
        'count-binding',
        'second-result',
      ],
      edgeIds: ['retains-access', 'updates-count', 'returns-second'],
    },
    {
      title: 'The same binding remains accessible',
      explanation:
        'The makeCounter call has already returned. The function held by counter still has access to its surrounding lexical environment and the same count binding, now 2. A closure does not copy count into a new variable on each call and does not preserve an entire active call stack. The two results are first = 1 and second = 2. This lesson ends without making a third call.',
      nodeIds: ['increment-function', 'lexical-environment', 'count-binding'],
      edgeIds: ['retains-access', 'contains-count'],
    },
  ],
};

// Presentation text only; never evaluate this string.
export const javascriptClosureCode =
  'function makeCounter() {\n  let count = 0;\n  return function increment() {\n    count += 1;\n    return count;\n  };\n}\n\nconst counter = makeCounter();\nconst first = counter();  // 1\nconst second = counter(); // 2';
