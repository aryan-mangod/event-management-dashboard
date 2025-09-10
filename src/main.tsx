import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

try {
	createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
	// If rendering fails during module evaluation, show the error on the page instead of a white screen
	const root = document.getElementById('root');
	if (root) {
		root.innerHTML = `<pre style="white-space:pre-wrap;color:#c53030;background:#fff5f5;padding:16px;border-radius:6px;">${String(err)}</pre>`;
	} else {
		console.error('Render error and root element missing', err);
	}
	throw err;
}
