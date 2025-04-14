
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-astra-red mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Oops! Page not found</p>
        <Button 
          onClick={() => navigate('/')} 
          className="bg-astra-red hover:bg-red-600 text-white"
        >
          Return Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
