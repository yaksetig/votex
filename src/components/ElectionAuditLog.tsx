
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Shield, Edit, AlertTriangle, Calculator, Clock } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string;
  details?: any;
  performed_at: string;
}

interface ElectionAuditLogProps {
  auditLog: AuditLogEntry[];
}

const ElectionAuditLog: React.FC<ElectionAuditLogProps> = ({ auditLog }) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'AUTHENTICATION':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'UPDATE_ELECTION':
        return <Edit className="h-4 w-4 text-amber-600" />;
      case 'CLOSE_ELECTION':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'PROCESS_TALLY':
        return <Calculator className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'AUTHENTICATION':
        return <Badge variant="outline">Auth</Badge>;
      case 'UPDATE_ELECTION':
        return <Badge variant="secondary">Edit</Badge>;
      case 'CLOSE_ELECTION':
        return <Badge variant="destructive">Close</Badge>;
      case 'PROCESS_TALLY':
        return <Badge variant="default">Tally</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatActionDetails = (action: string, details: any) => {
    if (!details) return null;

    switch (action) {
      case 'UPDATE_ELECTION':
        return (
          <div className="text-xs text-muted-foreground mt-1">
            Updated: {Object.keys(details.updates || {}).join(', ')}
          </div>
        );
      case 'CLOSE_ELECTION':
        return (
          <div className="text-xs text-muted-foreground mt-1">
            Reason: {details.reason || 'Manual closure'}
          </div>
        );
      case 'PROCESS_TALLY':
        return (
          <div className="text-xs text-muted-foreground mt-1">
            Processed {details.voterCount || 0} voter records
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Election Audit Log
        </CardTitle>
        <CardDescription>
          Complete history of all election authority actions for transparency and accountability
        </CardDescription>
      </CardHeader>
      <CardContent>
        {auditLog.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No audit log entries yet.</p>
            <p className="text-sm">Actions will appear here as they are performed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(entry.action)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActionBadge(entry.action)}
                    <span className="font-medium text-sm">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Performed by: <span className="font-medium">{entry.performed_by}</span>
                  </div>
                  
                  {formatActionDetails(entry.action, entry.details)}
                </div>
                
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.performed_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ElectionAuditLog;
