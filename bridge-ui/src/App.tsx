
import { Navbar } from './components/Navbar';
// import { Bridge } from './components/Bridge';
import './index.css';


function App() {
  return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <Navbar />
          <main className="pt-8 pb-16">
            {/* <Bridge /> */}
          </main>
        </div>
  );
}

export default App;