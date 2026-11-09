import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ScrollView, Platform } from 'react-native';

// A sideways-scrolling row (days, categories...) that ALSO scrolls with a mouse wheel on the web.
// On a phone it behaves exactly like a normal horizontal ScrollView.
// Use it instead of <ScrollView horizontal>. It accepts the same props, and ref.scrollTo({ x }).
const HScroll = forwardRef(function HScroll({ children, ...rest }, outerRef) {
  const ref = useRef(null);

  useImperativeHandle(outerRef, () => ({
    scrollTo: options => {
      if (ref.current && ref.current.scrollTo) ref.current.scrollTo(options);
    },
  }));

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node =
      ref.current && ref.current.getScrollableNode ? ref.current.getScrollableNode() : null;
    if (!node || !node.addEventListener) return undefined;

    // Turn the mouse wheel's up/down movement into left/right movement for this row.
    // At either end it lets the page scroll normally, so the page never feels stuck.
    const onWheel = e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already sideways (trackpad)
      const max = node.scrollWidth - node.clientWidth;
      if (max <= 0) return; // nothing to scroll sideways
      if (e.deltaY < 0 && node.scrollLeft <= 0) return;
      if (e.deltaY > 0 && node.scrollLeft >= max - 1) return;
      node.scrollLeft = Math.max(0, Math.min(max, node.scrollLeft + e.deltaY));
      e.preventDefault();
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} {...rest}>
      {children}
    </ScrollView>
  );
});

export default HScroll;