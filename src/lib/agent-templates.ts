// Agent templates: pre-built configurations for common agent types

export interface FlowStepConfig {
  systemPrompt?: string;
  userPromptTemplate?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  agentIdentity?: string;
  taskTemplate?: string;
  filenameTemplate?: string;
  contentTemplate?: string;
  outputType?: string;
}

export interface FlowStep {
  id: string;
  type: 'llm_call' | 'delegate' | 'output';
  name: string;
  config: FlowStepConfig;
}

export interface SuggestedSkill {
  name: string;
  description: string;
  input: string[];
  output: string[];
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultSystemPrompt: string;
  defaultOutputType: string;
  defaultFlow: FlowStep[];
  suggestedSkills: SuggestedSkill[];
  configNote: string;
}

// Default flow used when an agent has no custom flow
export const DEFAULT_FLOW: FlowStep[] = [
  {
    id: 'generate',
    type: 'llm_call',
    name: 'Generate',
    config: {
      userPromptTemplate: '{{work.description}}',
    },
  },
  {
    id: 'output',
    type: 'output',
    name: 'Output',
    config: {
      filenameTemplate: 'result.md',
      contentTemplate: '{{generate.output}}',
      outputType: 'markdown',
    },
  },
];

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // ── Text Generation ──
  {
    id: 'text_generation',
    name: 'Text Generator',
    description: 'Blog posts, articles, summaries, translations, marketing copy',
    icon: 'write',
    color: 'indigo',
    defaultSystemPrompt: `You are a professional writer for AgentNet. Write high-quality, engaging content.
Format your output as clean Markdown with:
- A compelling title (# heading)
- Well-structured sections with ## headings
- Clear, concise paragraphs
- A conclusion
Be informative and engaging. Do not include meta-commentary about being an AI.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'draft',
        type: 'llm_call',
        name: 'Draft content',
        config: { userPromptTemplate: '{{work.description}}' },
      },
      {
        id: 'refine',
        type: 'llm_call',
        name: 'Refine & polish',
        config: {
          systemPrompt: 'You are an editor. Improve the following content for clarity, flow, and impact. Keep the structure intact.',
          userPromptTemplate: 'Improve this content:\n\n{{draft.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Final output',
        config: {
          filenameTemplate: '{{work.title slug}}.md',
          contentTemplate: '{{refine.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Article Writing', description: 'Long-form articles and blog posts', input: ['topic', 'requirements'], output: ['markdown'] },
      { name: 'Summarization', description: 'Condense long text into summaries', input: ['text'], output: ['summary'] },
      { name: 'Translation', description: 'Translate text between languages', input: ['text', 'language'], output: ['translated text'] },
    ],
    configNote: 'Works with any text-based LLM. Use NVIDIA Llama, OpenAI GPT-4, or Anthropic Claude.',
  },

  // ── Image Generation ──
  {
    id: 'image_generation',
    name: 'Image Generator',
    description: 'Generate detailed image prompts, visual concepts, and art directions',
    icon: 'image',
    color: 'purple',
    defaultSystemPrompt: `You are an expert image generation assistant for AgentNet. Your job is to create detailed, high-quality image prompts and visual concepts.
For each request, produce:
1. A detailed image prompt optimized for diffusion models (DALL-E, Stable Diffusion, Midjourney)
2. Style, lighting, composition, and mood descriptions
3. Negative prompts (what to avoid)
4. 2-3 alternative variations
Format as clean Markdown. Be specific and visual.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'analyze',
        type: 'llm_call',
        name: 'Analyze request',
        config: {
          systemPrompt: 'You are a visual art director. Break down the user request into key visual elements: subject, style, mood, composition, color palette.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'prompts',
        type: 'llm_call',
        name: 'Generate image prompts',
        config: {
          userPromptTemplate: 'Based on this visual analysis, create detailed image generation prompts:\n\n{{analyze.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Image prompts',
        config: {
          filenameTemplate: 'image-prompts.md',
          contentTemplate: '{{prompts.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Image Prompt Engineering', description: 'Create optimized prompts for image AI models', input: ['description'], output: ['prompts'] },
      { name: 'Art Direction', description: 'Define visual style and direction', input: ['concept'], output: ['art direction'] },
    ],
    configNote: 'Set the model to a NIM image model (e.g. black-forest-labs/FLUX.1-dev) to generate real image artifacts.',
  },

  // ── Video Generation ──
  {
    id: 'video_generation',
    name: 'Video Generator',
    description: 'Video production plans, storyboards, and shot lists',
    icon: 'video',
    color: 'rose',
    defaultSystemPrompt: `You are a video production expert for AgentNet. Create detailed video production plans and storyboards.
Include: shot list, timing, visual descriptions, transitions, music/sound notes, camera angles, and editing notes.
Format as clean Markdown. Be cinematic and specific.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'concept',
        type: 'llm_call',
        name: 'Develop concept',
        config: {
          systemPrompt: 'You are a creative video director. Develop the core concept, narrative arc, and visual style for the requested video.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'storyboard',
        type: 'llm_call',
        name: 'Create storyboard',
        config: {
          userPromptTemplate: 'Create a detailed shot-by-shot storyboard based on this concept:\n\n{{concept.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Production plan',
        config: {
          filenameTemplate: 'production-plan.md',
          contentTemplate: '## Concept\n{{concept.output}}\n\n## Storyboard\n{{storyboard.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Storyboarding', description: 'Create shot-by-shot video storyboards', input: ['concept'], output: ['storyboard'] },
      { name: 'Production Planning', description: 'Plan video shoots including logistics', input: ['requirements'], output: ['plan'] },
    ],
    configNote: 'Produces detailed production plans. For AI video generation, connect a video API in the flow.',
  },

  // ── Code Generation ──
  {
    id: 'code_generation',
    name: 'Code Generator',
    description: 'Generate clean, working code in any language with explanations',
    icon: 'code',
    color: 'cyan',
    defaultSystemPrompt: `You are an expert full-stack developer for AgentNet. Generate clean, working, well-commented code.
- Provide complete, runnable code (not snippets)
- Include file names as comments at the top of each code block
- Use modern best practices and conventions
- Explain your approach briefly before the code
- Handle edge cases and errors
- Include usage examples
Format as clean Markdown with code blocks.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'plan',
        type: 'llm_call',
        name: 'Plan approach',
        config: {
          systemPrompt: 'You are a software architect. Plan the technical approach, file structure, and key functions needed. Keep it concise.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'code',
        type: 'llm_call',
        name: 'Generate code',
        config: {
          userPromptTemplate: 'Based on this plan, generate the complete implementation:\n\n{{plan.output}}',
        },
      },
      {
        id: 'review',
        type: 'llm_call',
        name: 'Review & refine',
        config: {
          systemPrompt: 'You are a code reviewer. Check for bugs, edge cases, and improvements. Output the final improved version of the code.',
          userPromptTemplate: 'Review and improve this code:\n\n{{code.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Final code',
        config: {
          filenameTemplate: 'solution.md',
          contentTemplate: '## Plan\n{{plan.output}}\n\n## Implementation\n{{review.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Code Generation', description: 'Generate code in any language', input: ['specification'], output: ['code'] },
      { name: 'Refactoring', description: 'Improve existing code quality', input: ['code'], output: ['refactored code'] },
      { name: 'API Design', description: 'Design REST/GraphQL APIs', input: ['requirements'], output: ['API spec'] },
    ],
    configNote: 'Works best with powerful models (GPT-4, Claude 3.5). Configure model in LLM settings.',
  },

  // ── App Generation ──
  {
    id: 'app_generation',
    name: 'App Generator',
    description: 'Generate complete application code with architecture, multiple files, and setup instructions',
    icon: 'app',
    color: 'blue',
    defaultSystemPrompt: `You are a full-stack application architect and developer for AgentNet. Generate complete, production-ready applications.
- Design the architecture first (frontend, backend, database)
- Generate all necessary files with proper structure
- Include setup and deployment instructions
- Use modern frameworks (React, Next.js, Express, etc.)
- Include environment configuration
- Add error handling and validation
Format as clean Markdown with code blocks and file headers.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'architecture',
        type: 'llm_call',
        name: 'Design architecture',
        config: {
          systemPrompt: 'You are a software architect. Design the complete application architecture: tech stack, file structure, data models, API endpoints, and component hierarchy.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'backend',
        type: 'llm_call',
        name: 'Generate backend',
        config: {
          systemPrompt: 'You are a backend developer. Generate all backend code: models, routes, middleware, and configuration.',
          userPromptTemplate: 'Based on this architecture, generate the backend code:\n\n{{architecture.output}}',
        },
      },
      {
        id: 'frontend',
        type: 'llm_call',
        name: 'Generate frontend',
        config: {
          systemPrompt: 'You are a frontend developer. Generate all frontend code: components, pages, styles, and configuration.',
          userPromptTemplate: 'Based on this architecture, generate the frontend code:\n\n{{architecture.output}}',
        },
      },
      {
        id: 'readme',
        type: 'llm_call',
        name: 'Generate setup guide',
        config: {
          systemPrompt: 'You are a technical writer. Create a comprehensive README with setup, configuration, and deployment instructions.',
          userPromptTemplate: 'Create setup instructions for this app:\n\n## Architecture\n{{architecture.output}}\n\n## Backend\n{{backend.output}}\n\n## Frontend\n{{frontend.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Complete app',
        config: {
          filenameTemplate: 'app-implementation.md',
          contentTemplate: '# Application Implementation\n\n## Architecture\n{{architecture.output}}\n\n## Backend Code\n{{backend.output}}\n\n## Frontend Code\n{{frontend.output}}\n\n## Setup Guide\n{{readme.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Full-Stack Development', description: 'Build complete web applications', input: ['specification'], output: ['application code'] },
      { name: 'Architecture Design', description: 'Design scalable application architectures', input: ['requirements'], output: ['architecture'] },
    ],
    configNote: 'Requires high-capability models (GPT-4, Claude 3.5). May need sub-agent delegation for large apps.',
  },

  // ── Bug Finder ──
  {
    id: 'bug_finder',
    name: 'Bug Finder',
    description: 'Analyze code, find bugs, vulnerabilities, and code quality issues',
    icon: 'bug',
    color: 'amber',
    defaultSystemPrompt: `You are an expert code auditor and security analyst for AgentNet. Find bugs, vulnerabilities, and code quality issues.
For each issue found, report:
- Severity (Critical / High / Medium / Low)
- Location (file, function, line if possible)
- Description of the issue
- Impact if left unfixed
- Suggested fix
Format as a clean Markdown report with a summary table at the top.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'analyze',
        type: 'llm_call',
        name: 'Analyze code',
        config: {
          systemPrompt: 'You are a code auditor. Identify all bugs, security vulnerabilities, performance issues, and code quality problems. Be thorough.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'prioritize',
        type: 'llm_call',
        name: 'Prioritize issues',
        config: {
          systemPrompt: 'You are a technical lead. Organize the findings by severity and create a summary table.',
          userPromptTemplate: 'Organize these findings by severity:\n\n{{analyze.output}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Bug report',
        config: {
          filenameTemplate: 'bug-report.md',
          contentTemplate: '{{prioritize.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Code Review', description: 'Review code for bugs and best practices', input: ['code'], output: ['review'] },
      { name: 'Security Audit', description: 'Find security vulnerabilities', input: ['code'], output: ['audit report'] },
      { name: 'Performance Analysis', description: 'Identify performance bottlenecks', input: ['code'], output: ['analysis'] },
    ],
    configNote: 'Works with any LLM. For complex codebases, delegate to multiple specialized sub-agents.',
  },

  // ── Error Solver ──
  {
    id: 'error_solver',
    name: 'Error Solver',
    description: 'Diagnose errors, find root causes, and generate working fixes',
    icon: 'fix',
    color: 'green',
    defaultSystemPrompt: `You are an expert debugger and problem solver for AgentNet. Diagnose errors and provide working solutions.
For each error:
1. Identify the root cause
2. Explain why the error occurs
3. Provide the corrected code
4. Add a brief explanation of the fix
Format as clean Markdown with code blocks.`,
    defaultOutputType: 'markdown',
    defaultFlow: [
      {
        id: 'diagnose',
        type: 'llm_call',
        name: 'Diagnose error',
        config: {
          systemPrompt: 'You are a debugging expert. Analyze the error message and code. Identify the root cause and explain why it happens.',
          userPromptTemplate: '{{work.description}}',
        },
      },
      {
        id: 'fix',
        type: 'llm_call',
        name: 'Generate fix',
        config: {
          systemPrompt: 'You are a developer. Generate the corrected code with explanations. Make sure the fix is complete and handles edge cases.',
          userPromptTemplate: 'Based on this diagnosis, provide the fix:\n\n## Diagnosis\n{{diagnose.output}}\n\n## Original Problem\n{{work.description}}',
        },
      },
      {
        id: 'output',
        type: 'output',
        name: 'Solution',
        config: {
          filenameTemplate: 'solution.md',
          contentTemplate: '## Diagnosis\n{{diagnose.output}}\n\n## Fix\n{{fix.output}}',
          outputType: 'markdown',
        },
      },
    ],
    suggestedSkills: [
      { name: 'Error Diagnosis', description: 'Diagnose and explain code errors', input: ['error', 'code'], output: ['diagnosis'] },
      { name: 'Bug Fixing', description: 'Generate working fixes for bugs', input: ['bug description', 'code'], output: ['fixed code'] },
      { name: 'Log Analysis', description: 'Analyze error logs to find issues', input: ['logs'], output: ['analysis'] },
    ],
    configNote: 'Provide error messages and relevant code in the work description for best results.',
  },

  // ── Custom ──
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Build from scratch — define your own system prompt, flow, and configuration',
    icon: 'custom',
    color: 'zinc',
    defaultSystemPrompt: `You are a helpful AI assistant for AgentNet. Complete the requested task thoroughly.
Provide your response in clean Markdown format. Be clear and well-structured.`,
    defaultOutputType: 'markdown',
    defaultFlow: DEFAULT_FLOW,
    suggestedSkills: [],
    configNote: 'Full control. Configure LLM, system prompt, and flow from scratch.',
  },
];
