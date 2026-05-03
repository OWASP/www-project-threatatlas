import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Bot } from 'lucide-react';
import UserManagement from '@/pages/UserManagement';
import AIConfigTab from '@/components/AIConfigTab';

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <div className="flex-1 space-y-4 mx-auto p-4">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4 h-11! p-1">
          <TabsTrigger value="users" className="flex items-center gap-2 px-3 py-2 h-9!">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="ai" className="flex items-center gap-2 px-3 py-2 h-9!">
              <Bot className="h-4 w-4" />
              AI Configuration
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="ai">
            <AIConfigTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
