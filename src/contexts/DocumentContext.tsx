import React, { createContext, useCallback, useContext, useState } from "react";

type DocContextType = {
  documentVersion: number;
  isUploaded: boolean;
  setDocumentUploaded: () => void;
  clearSession: () => void; // New: Explicit reset
};

const DocumentContext = createContext<DocContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documentVersion, setDocumentVersion] = useState<number>(0);
  const [isUploaded, setIsUploaded] = useState<boolean>(false);

  const setDocumentUploaded = useCallback(() => {
    setDocumentVersion((v) => v + 1);
    setIsUploaded(true);
  }, []);

  // FIX: Explicit session clearing
  // Call this when the user clicks "Close Lesson" or "Analyze Another"
  const clearSession = useCallback(() => {
    setIsUploaded(false);
    setDocumentVersion(0);
  }, []);

  return (
    <DocumentContext.Provider
      value={{
        documentVersion,
        isUploaded,
        setDocumentUploaded,
        clearSession,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocument = () => {
  const ctx = useContext(DocumentContext);
  if (!ctx) {
    throw new Error("useDocument must be used inside DocumentProvider");
  }
  return ctx;
};