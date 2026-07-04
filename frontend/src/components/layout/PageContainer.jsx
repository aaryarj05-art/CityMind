import Sidebar from './Sidebar';
import Topbar from './Topbar';

const PageContainer = ({ title, children }) => {
  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <div className="flex-1 ml-20 lg:ml-64 min-w-0 flex flex-col">
        <Topbar title={title} />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageContainer;
