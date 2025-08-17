import React from 'react';
import { AlertTriangle, Chrome } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getBrowserInfo, getBrowserRestrictionMessage } from '@/utils/browserDetection';

interface BrowserRestrictionProps {
  onForceAccess?: () => void;
  showForceAccess?: boolean;
}

const BrowserRestriction: React.FC<BrowserRestrictionProps> = ({ 
  onForceAccess, 
  showForceAccess = false 
}) => {
  const { browserName, isMobile } = getBrowserInfo();
  const message = getBrowserRestrictionMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4">
      <Card className="max-w-md w-full border-red-200 dark:border-red-800">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-red-800 dark:text-red-200 text-xl">
            Browser Not Supported
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-red-700 dark:text-red-300 mb-4">
              {message}
            </p>
            
            <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Chrome className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  Google Chrome Required
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Our assessment system requires Chrome for proper anti-cheating measures including:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                <li>• Fullscreen enforcement</li>
                <li>• Tab switching detection</li>
                <li>• Face recognition (if enabled)</li>
                <li>• Screen recording prevention</li>
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                To take this assessment:
              </p>
              <ol className="text-sm text-left text-gray-700 dark:text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">1.</span>
                  {isMobile ? 
                    "Install Google Chrome from your app store" : 
                    "Download and install Google Chrome"
                  }
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">2.</span>
                  Open this assessment link in Chrome
                </li>
                <li className="flex items-start">
                  <span className="font-semibold text-blue-600 mr-2">3.</span>
                  Allow all permissions when prompted
                </li>
              </ol>
            </div>

            {showForceAccess && onForceAccess && (
              <div className="mt-6 pt-4 border-t border-red-200 dark:border-red-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  For testing purposes only:
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onForceAccess}
                  className="text-xs"
                >
                  Force Access (Testing)
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrowserRestriction;