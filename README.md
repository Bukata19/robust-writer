# 🤖 Robobuddy Writer

A modern, feature-rich document writing application built with React and TypeScript. Robobuddy Writer provides an intuitive interface for creating, editing, and exporting documents with support for multiple formats and AI-powered features.

## ✨ Features

- **Rich Text Editing**: Write and format documents with an intuitive editor
- **Multiple Export Formats**: Export to PDF, DOCX, and other document formats
- **AI Integration**: Leverage AI capabilities for writing assistance (via Supabase)
- **Dark Mode Support**: Built-in theme switching for comfortable writing
- **Responsive Design**: Seamless experience across desktop and tablet devices
- **Form Handling**: Advanced form management with validation (React Hook Form + Zod)
- **UI Components**: Comprehensive component library with Radix UI
- **Real-time Collaboration Ready**: Built with Supabase for scalable backend support

## 🛠️ Tech Stack

### Frontend
- **React** 18.3.1 - UI library
- **TypeScript** 5.8.3 - Type safety
- **Vite** 5.4.19 - Fast build tool and dev server
- **Tailwind CSS** 3.4.17 - Utility-first styling
- **Radix UI** - Unstyled, accessible component library

### Libraries & Tools
- **React Router** 6.30.1 - Client-side routing
- **React Hook Form** 7.61.1 - Efficient form management
- **Zod** 3.25.76 - TypeScript-first schema validation
- **React Query** 5.83.0 - Data fetching and caching
- **Recharts** 2.15.4 - Data visualization
- **React Markdown** 10.1.0 - Markdown rendering
- **Docx** 9.6.1 - Generate DOCX files
- **html2pdf.js** 0.14.0 - PDF export
- **Lucide React** 0.462.0 - Icon library
- **Sonner** 1.7.4 - Toast notifications

### Backend & Database
- **Supabase** 2.100.1 - Backend-as-a-service with PostgreSQL

### Development Tools
- **Playwright** 1.57.0 - E2E testing
- **Vitest** 3.2.4 - Unit testing
- **ESLint** 9.32.0 - Code quality
- **Tailwind CSS** 3.4.17 - Styling

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun (as indicated by lock files)
- npm or Bun package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Bukata19/robobuddy-writer.git
   cd robobuddy-writer
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or with Bun
   bun install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or with Bun
   bun run dev
   ```
   The application will be available at `http://localhost:5173`

## 📝 Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Build in development mode
npm run build:dev

# Preview production build locally
npm run preview

# Run linting
npm run lint

# Run unit tests
npm run test

# Watch mode for tests
npm run test:watch
```

## 📁 Project Structure

```
robobuddy-writer/
├── src/
│   ├── components/       # Reusable React components
│   ├── contexts/         # React Context for state management
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── lib/              # Utility functions and helpers
│   ├── integrations/     # External service integrations
│   ├── test/             # Test utilities and setup
│   ├── App.tsx           # Main App component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── supabase/             # Supabase configuration and migrations
├── package.json          # Project dependencies
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## 🧪 Testing

### Unit Tests
Run unit tests with Vitest:
```bash
npm run test
```

### E2E Tests
Playwright tests can be configured and run:
```bash
npx playwright test
```

## 🎨 Styling

This project uses **Tailwind CSS** for styling with custom configuration. The `tailwind.config.ts` includes:
- Custom color schemes
- Typography plugins
- Animation utilities
- Responsive design utilities

## 🔐 Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🙋 Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

## 🎯 Future Enhancements

- [ ] Collaborative editing
- [ ] Rich text formatting toolbar
- [ ] Document templates
- [ ] Cloud storage integration
- [ ] Mobile app version
- [ ] Multi-language support

---

**Built with ❤️ by Bukata19**