import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VynedamPage from "./home";
import History from "./History";
import ProjectPage from "./ProjectPage";
import Login from "./Login";
import Signup from "./Signup";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VynedamPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/history" element={<History />} />
        <Route path="/project/:id" element={<ProjectPage />} />
        
          
      </Routes>
    </Router>
  );
}

export default App;