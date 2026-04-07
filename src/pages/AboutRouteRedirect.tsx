import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAboutSheet } from "@/context/AboutSheetContext";
import PageLoader from "@/components/PageLoader";

/** Opens the about sheet and sends the user home (replaces standalone /about page). */
const AboutRouteRedirect = () => {
  const navigate = useNavigate();
  const { openAbout } = useAboutSheet();

  useEffect(() => {
    openAbout();
    navigate("/", { replace: true });
  }, [navigate, openAbout]);

  return <PageLoader />;
};

export default AboutRouteRedirect;
