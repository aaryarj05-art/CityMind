import { useAuth } from '../../auth/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PageContainer = ({ title, children }) => {
  const { judgeMode } = useAuth();
  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <div className="flex-1 ml-20 lg:ml-64 min-w-0 flex flex-col">
        <Topbar title={title} />
        {judgeMode && (
          <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-xs font-semibold text-amber-200" role="status" data-testid="judge-mode-banner">
            Hackathon Judge Mode â€” all authenticated Google users have full demonstration access. Not intended for production use.
          </div>
        )}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
export default PageContainer;
