import { ExpoRoot } from 'expo-router';
import { AppProviders } from './providers/AppProviders';

const ctx = (require as any).context('./app');

export default function App() {
  return (
    <AppProviders>
      <ExpoRoot context={ctx} />
    </AppProviders>
  );
}
