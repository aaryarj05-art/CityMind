import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PageContainer = ({ title, children }) => {
  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Topbar title={title} />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageContainer;
