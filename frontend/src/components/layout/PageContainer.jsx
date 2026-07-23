import { useAuth } from '../../auth/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PageContainer = ({ title, children }) => {
  const { judgeMode } = useAuth();

  return (
    <div className="cm-shell flex min-h-screen bg-navy-950">
      <Sidebar />

      <div className="ml-20 flex min-w-0 flex-1 flex-col lg:ml-64">
        <Topbar title={title} />

        {judgeMode && (
          <div
            className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs font-semibold text-amber-100 backdrop-blur"
            role="status"
            data-testid="judge-mode-banner"
          >
            Hackathon Judge Mode — all authenticated Google users have full
            demonstration access. Not intended for production use.
          </div>
        )}

        <main className="cm-fade-up flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageContainer;