/**
 * Re-export auth hooks from AuthContext for clean imports within the app/ directory.
 */

export {
  useAuth,
  useUser,
  useIsAuthenticated,
} from "../../context/AuthContext";
