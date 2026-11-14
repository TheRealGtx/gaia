import { GaiaApp } from "../src/components/pages/GaiaApp";
import { AppProvider } from "../src/state/AppProvider";

export default function HomePage() {
  return <AppProvider><GaiaApp /></AppProvider>;
}
