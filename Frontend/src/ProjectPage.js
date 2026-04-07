import { useParams } from "react-router-dom";


function ProjectPage() {
  const { id } = useParams();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Project {id}</h1>
      <p>This is your project page 🚀</p>
    </div>
  );
}

export default ProjectPage;