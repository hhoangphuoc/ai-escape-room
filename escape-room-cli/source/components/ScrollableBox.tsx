import React, { useEffect, useRef, useState } from 'react';
import { Box, useInput } from 'ink';
import type { Key } from 'ink';

interface ScrollableBoxProps {
  children: React.ReactNode;
  height?: number; 
}

const ScrollableBox: React.FC<ScrollableBoxProps> = ({ 
  children, 
  height = 20 // Default height
}) => {
  const [scrollPos, setScrollPos] = useState(0);
  const childrenArray = React.Children.toArray(children);
  const totalItems = childrenArray.length;
  const maxScroll = Math.max(0, totalItems - height);
  
  // Auto-scroll to bottom on new content
  const prevChildrenLengthRef = useRef(totalItems);
  
  useEffect(() => {
    if (totalItems > prevChildrenLengthRef.current) {
      setScrollPos(maxScroll);
    }
    prevChildrenLengthRef.current = totalItems;
  }, [totalItems, maxScroll]);
  
  // Handle keyboard scrolling
  useInput((_: string, key: Key) => {
    if (key.upArrow) {
      setScrollPos(Math.max(0, scrollPos - 1));
    } else if (key.downArrow) {
      setScrollPos(Math.min(maxScroll, scrollPos + 1));
    } else if (key.pageUp) {
      setScrollPos(Math.max(0, scrollPos - height));
    } else if (key.pageDown) {
      setScrollPos(Math.min(maxScroll, scrollPos + height));
    }
  });
  
  // Calculate which items to show in view
  const visibleChildren = childrenArray.slice(scrollPos, scrollPos + height);
  
  return (
    <Box flexDirection="column">
      {visibleChildren}
      {totalItems > height && (
        <Box marginTop={1}>
          <Box marginRight={1}>
            <Box>
              <Box marginRight={1}>
                <Box>Scroll: {scrollPos + 1}/{totalItems}</Box>
              </Box>
              {scrollPos > 0 ? '↑' : ' '}
              {scrollPos < maxScroll ? '↓' : ' '}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ScrollableBox;