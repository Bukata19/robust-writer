import { Mark, mergeAttributes } from '@tiptap/core';

export interface PlagiarismHighlightOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    plagiarismHighlight: {
      setPlagiarismHighlight: (attributes?: { severity?: string }) => ReturnType;
      unsetPlagiarismHighlight: () => ReturnType;
    };
  }
}

const PlagiarismHighlight = Mark.create<PlagiarismHighlightOptions>({
  name: 'plagiarismHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      severity: {
        default: 'medium',
        parseHTML: (element) => element.getAttribute('data-severity') || 'medium',
        renderHTML: (attributes) => ({
          'data-severity': attributes.severity,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-plagiarism-highlight]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const severity = HTMLAttributes['data-severity'] || 'medium';
    const colorClass =
      severity === 'high'
        ? 'plagiarism-highlight-high'
        : 'plagiarism-highlight-medium';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-plagiarism-highlight': '',
        class: `plagiarism-highlight ${colorClass}`,
      }),
      0,
    ];
  },
});

export default PlagiarismHighlight;
