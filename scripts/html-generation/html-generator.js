export var HTMLGeneration;
(function (HTMLGeneration) {
    function makeHeadingsTrees(html) {
        // make headers into format:
        /*
        - .heading-wrapper
            - h1.heading
                - .heading-before
                - .heading-collapse-indicator.collapse-indicator.collapse-icon
                - "Text"
                - .heading-after
            - .heading-children
        */
        function getHeaderEl(headingContainer) {
            let first = headingContainer.firstElementChild;
            if (first && /[Hh][1-6]/g.test(first.tagName))
                return first;
            else
                return;
        }
        function makeHeaderTree(headerDiv, childrenContainer) {
            let headerEl = getHeaderEl(headerDiv);
            if (!headerEl)
                return;
            let possibleChild = headerDiv.nextElementSibling;
            while (possibleChild != null) {
                let possibleChildHeader = getHeaderEl(possibleChild);
                if (possibleChildHeader) {
                    // if header is a sibling of this header then break
                    if (possibleChildHeader.tagName <= headerEl.tagName) {
                        break;
                    }
                    // if we reached the footer then break
                    if (possibleChildHeader.querySelector(":has(section.footnotes)") || possibleChildHeader.classList.contains("mod-footer")) {
                        break;
                    }
                }
                let nextEl = possibleChild.nextElementSibling;
                childrenContainer.appendChild(possibleChild);
                possibleChild = nextEl;
            }
        }
        const arrowHTML = "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='svg-icon right-triangle'><path d='M3 8L12 17L21 8'></path></svg>";
        html.querySelectorAll("div:has(> :is(h1, h2, h3, h4, h5, h6)):not(.markdown-preview-sizer)").forEach(function (header) {
            header.classList.add("heading-wrapper");
            let hEl = getHeaderEl(header);
            if (!hEl || hEl.classList.contains("heading"))
                return;
            hEl.classList.add("heading");
            let collapseIcon = hEl.querySelector(".heading-collapse-indicator");
            if (!collapseIcon) {
                collapseIcon = hEl.createDiv({ cls: "heading-collapse-indicator collapse-indicator collapse-icon" });
                collapseIcon.innerHTML = arrowHTML;
                hEl.prepend(collapseIcon);
            }
            if (!hEl.querySelector(".heading-after")) {
                let afterEl = hEl.createDiv({ cls: "heading-after" });
                afterEl.textContent = "...";
            }
            // the before element is for future styling
            if (!hEl.querySelector(".heading-before")) {
                let beforeEl = hEl.createDiv({ cls: "heading-before" });
                hEl.prepend(beforeEl);
                beforeEl.textContent = "";
            }
            let children = header.createDiv({ cls: "heading-children" });
            makeHeaderTree(header, children);
        });
        // remove collapsible arrows from h1 and inline titles
        html.querySelectorAll("div h1, div .inline-title").forEach((element) => {
            var _a;
            (_a = element.querySelector(".heading-collapse-indicator")) === null || _a === void 0 ? void 0 : _a.remove();
        });
        // remove all new lines from header elements which cause spacing issues
        html.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => el.innerHTML = el.innerHTML.replaceAll("\n", ""));
    }
    HTMLGeneration.makeHeadingsTrees = makeHeadingsTrees;
    function createThemeToggle(container) {
        let toggle = container.createDiv();
        let label = toggle.createEl("label");
        let input = label.createEl("input");
        let div = label.createDiv();
        label.classList.add("theme-toggle-container");
        label.setAttribute("for", "theme_toggle");
        input.classList.add("theme-toggle-input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("id", "theme_toggle");
        div.classList.add("toggle-background");
        return toggle;
    }
    HTMLGeneration.createThemeToggle = createThemeToggle;
})(HTMLGeneration || (HTMLGeneration = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHRtbC1nZW5lcmF0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJodG1sLWdlbmVyYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxNQUFNLEtBQVcsY0FBYyxDQTRIOUI7QUE1SEQsV0FBaUIsY0FBYztJQUc5QixTQUFnQixpQkFBaUIsQ0FBQyxJQUFpQjtRQUVsRCw0QkFBNEI7UUFDNUI7Ozs7Ozs7O1VBUUU7UUFFRixTQUFTLFdBQVcsQ0FBQyxnQkFBZ0M7WUFFcEQsSUFBSSxLQUFLLEdBQUcsZ0JBQWdCLENBQUMsaUJBQWlCLENBQUM7WUFDL0MsSUFBSSxLQUFLLElBQUksWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDOztnQkFDdkQsT0FBTztRQUNiLENBQUM7UUFFRCxTQUFTLGNBQWMsQ0FBQyxTQUF5QixFQUFFLGlCQUE4QjtZQUVoRixJQUFJLFFBQVEsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFdEMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTztZQUV0QixJQUFJLGFBQWEsR0FBRyxTQUFTLENBQUMsa0JBQWtCLENBQUM7WUFFakQsT0FBTyxhQUFhLElBQUksSUFBSSxFQUM1QjtnQkFDQyxJQUFJLG1CQUFtQixHQUFHLFdBQVcsQ0FBQyxhQUErQixDQUFDLENBQUM7Z0JBRXZFLElBQUcsbUJBQW1CLEVBQ3RCO29CQUNDLG1EQUFtRDtvQkFDbkQsSUFBSSxtQkFBbUIsQ0FBQyxPQUFPLElBQUksUUFBUSxDQUFDLE9BQU8sRUFDbkQ7d0JBQ0MsTUFBTTtxQkFDTjtvQkFFRCxzQ0FBc0M7b0JBQ3RDLElBQUksbUJBQW1CLENBQUMsYUFBYSxDQUFDLHlCQUF5QixDQUFDLElBQUksbUJBQW1CLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFDeEg7d0JBQ0MsTUFBTTtxQkFDTjtpQkFDRDtnQkFFRCxJQUFJLE1BQU0sR0FBRyxh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RyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUU1QixLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQzlDLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRTFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDMUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkMsS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFFekMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUV2QyxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFqQmUsZ0NBQWlCLG9CQWlCaEMsQ0FBQTtBQUVGLENBQUMsRUE1SGdCLGNBQWMsS0FBZCxjQUFjLFFBNEg5QiIsInNvdXJjZXNDb250ZW50IjpbIlxyXG5leHBvcnQgbmFtZXNwYWNlIEhUTUxHZW5lcmF0aW9uXHJcbntcclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIG1ha2VIZWFkaW5nc1RyZWVzKGh0bWw6IEhUTUxFbGVtZW50KVxyXG5cdHtcclxuXHRcdC8vIG1ha2UgaGVhZGVycyBpbnRvIGZvcm1hdDpcclxuXHRcdC8qXHJcblx0XHQtIC5oZWFkaW5nLXdyYXBwZXJcclxuXHRcdFx0LSBoMS5oZWFkaW5nXHJcblx0XHRcdFx0LSAuaGVhZGluZy1iZWZvcmVcclxuXHRcdFx0XHQtIC5oZWFkaW5nLWNvbGxhcHNlLWluZGljYXRvci5jb2xsYXBzZS1pbmRpY2F0b3IuY29sbGFwc2UtaWNvblxyXG5cdFx0XHRcdC0gXCJUZXh0XCJcclxuXHRcdFx0XHQtIC5oZWFkaW5nLWFmdGVyXHJcblx0XHRcdC0gLmhlYWRpbmctY2hpbGRyZW5cclxuXHRcdCovXHJcblxyXG5cdFx0ZnVuY3Rpb24gZ2V0SGVhZGVyRWwoaGVhZGluZ0NvbnRhaW5lcjogSFRNTERpdkVsZW1lbnQpXHJcblx0XHR7XHJcblx0XHRcdGxldCBmaXJzdCA9IGhlYWRpbmdDb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQ7XHJcblx0XHRcdGlmIChmaXJzdCAmJiAvW0hoXVsxLTZdL2cudGVzdChmaXJzdC50YWdOYW1lKSkgcmV0dXJuIGZpcnN0O1xyXG5cdFx0XHRlbHNlIHJldHVybjtcclxuXHRcdH1cclxuXHRcdFxyXG5cdFx0ZnVuY3Rpb24gbWFrZUhlYWRlclRyZWUoaGVhZGVyRGl2OiBIVE1MRGl2RWxlbWVudCwgY2hpbGRyZW5Db250YWluZXI6IEhUTUxFbGVtZW50KVxyXG5cdFx0e1xyXG5cdFx0XHRsZXQgaGVhZGVyRWwgPSBnZXRIZWFkZXJFbChoZWFkZXJEaXYpO1xyXG5cclxuXHRcdFx0aWYgKCFoZWFkZXJFbCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0bGV0IHBvc3NpYmxlQ2hpbGQgPSBoZWFkZXJEaXYubmV4dEVsZW1lbnRTaWJsaW5nO1xyXG5cclxuXHRcdFx0d2hpbGUgKHBvc3NpYmxlQ2hpbGQgIT0gbnVsbClcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBwb3NzaWJsZUNoaWxkSGVhZGVyID0gZ2V0SGVhZGVyRWwocG9zc2libGVDaGlsZCBhcyBIVE1MRGl2RWxlbWVudCk7XHJcblxyXG5cdFx0XHRcdGlmKHBvc3NpYmxlQ2hpbGRIZWFkZXIpXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Ly8gaWYgaGVhZGVyIGlzIGEgc2libGluZyBvZiB0aGlzIGhlYWRlciB0aGVuIGJyZWFrXHJcblx0XHRcdFx0XHRpZiAocG9zc2libGVDaGlsZEhlYWRlci50YWdOYW1lIDw9IGhlYWRlckVsLnRhZ05hbWUpXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIGlmIHdlIHJlYWNoZWQgdGhlIGZvb3RlciB0aGVuIGJyZWFrXHJcblx0XHRcdFx0XHRpZiAocG9zc2libGVDaGlsZEhlYWRlci5xdWVyeVNlbGVjdG9yKFwiOmhhcyhzZWN0aW9uLmZvb3Rub3RlcylcIikgfHwgcG9zc2libGVDaGlsZEhlYWRlci5jbGFzc0xpc3QuY29udGFpbnMoXCJtb2QtZm9vdGVyXCIpKVxyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGxldCBuZXh0RWwgPSBwb3NzaWJsZUNoaWxkLm5leHRFbGVtZW50U2libGluZztcclxuXHRcdFx0XHRjaGlsZHJlbkNvbnRhaW5lci5hcHBlbmRDaGlsZChwb3NzaWJsZUNoaWxkKTtcclxuXHRcdFx0XHRwb3NzaWJsZUNoaWxkID0gbmV4dEVsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgYXJyb3dIVE1MID0gXCI8c3ZnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zycgd2lkdGg9JzI0JyBoZWlnaHQ9JzI0JyB2aWV3Qm94PScwIDAgMjQgMjQnIGZpbGw9J25vbmUnIHN0cm9rZT0nY3VycmVudENvbG9yJyBzdHJva2Utd2lkdGg9JzInIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCcgY2xhc3M9J3N2Zy1pY29uIHJpZ2h0LXRyaWFuZ2xlJz48cGF0aCBkPSdNMyA4TDEyIDE3TDIxIDgnPjwvcGF0aD48L3N2Zz5cIjtcclxuXHJcblx0XHRodG1sLnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXY6aGFzKD4gOmlzKGgxLCBoMiwgaDMsIGg0LCBoNSwgaDYpKTpub3QoLm1hcmtkb3duLXByZXZpZXctc2l6ZXIpXCIpLmZvckVhY2goZnVuY3Rpb24gKGhlYWRlcjogSFRNTERpdkVsZW1lbnQpXHJcblx0XHR7XHJcblx0XHRcdGhlYWRlci5jbGFzc0xpc3QuYWRkKFwiaGVhZGluZy13cmFwcGVyXCIpO1xyXG5cclxuXHRcdFx0bGV0IGhFbCA9IGdldEhlYWRlckVsKGhlYWRlcikgYXMgSFRNTEhlYWRpbmdFbGVtZW50O1xyXG5cclxuXHRcdFx0aWYgKCFoRWwgfHwgaEVsLmNsYXNzTGlzdC5jb250YWlucyhcImhlYWRpbmdcIikpIHJldHVybjtcclxuXHJcblx0XHRcdGhFbC5jbGFzc0xpc3QuYWRkKFwiaGVhZGluZ1wiKTtcclxuXHJcblx0XHRcdGxldCBjb2xsYXBzZUljb24gPSBoRWwucXVlcnlTZWxlY3RvcihcIi5oZWFkaW5nLWNvbGxhcHNlLWluZGljYXRvclwiKTtcclxuXHRcdFx0aWYgKCFjb2xsYXBzZUljb24pXHJcblx0XHRcdHtcclxuXHRcdFx0XHRjb2xsYXBzZUljb24gPSBoRWwuY3JlYXRlRGl2KHsgY2xzOiBcImhlYWRpbmctY29sbGFwc2UtaW5kaWNhdG9yIGNvbGxhcHNlLWluZGljYXRvciBjb2xsYXBzZS1pY29uXCIgfSk7XHJcblx0XHRcdFx0Y29sbGFwc2VJY29uLmlubmVySFRNTCA9IGFycm93SFRNTDtcclxuXHRcdFx0XHRoRWwucHJlcGVuZChjb2xsYXBzZUljb24pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIWhFbC5xdWVyeVNlbGVjdG9yKFwiLmhlYWRpbmctYWZ0ZXJcIikpIFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0bGV0IGFmdGVyRWwgPSBoRWwuY3JlYXRlRGl2KHsgY2xzOiBcImhlYWRpbmctYWZ0ZXJcIiB9KTtcclxuXHRcdFx0XHRhZnRlckVsLnRleHRDb250ZW50ID0gXCIuLi5cIjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gdGhlIGJlZm9yZSBlbGVtZW50IGlzIGZvciBmdXR1cmUgc3R5bGluZ1xyXG5cdFx0XHRpZiAoIWhFbC5xdWVyeVNlbGVjdG9yKFwiLmhlYWRpbmctYmVmb3JlXCIpKSBcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGxldCBiZWZvcmVFbCA9IGhFbC5jcmVhdGVEaXYoeyBjbHM6IFwiaGVhZGluZy1iZWZvcmVcIiB9KTtcclxuXHRcdFx0XHRoRWwucHJlcGVuZChiZWZvcmVFbCk7XHJcblx0XHRcdFx0YmVmb3JlRWwudGV4dENvbnRlbnQgPSBcIlwiO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgY2hpbGRyZW4gPSBoZWFkZXIuY3JlYXRlRGl2KHsgY2xzOiBcImhlYWRpbmctY2hpbGRyZW5cIiB9KTtcclxuXHJcblx0XHRcdG1ha2VIZWFkZXJUcmVlKGhlYWRlciwgY2hpbGRyZW4pO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gcmVtb3ZlIGNvbGxhcHNpYmxlIGFycm93cyBmcm9tIGgxIGFuZCBpbmxpbmUgdGl0bGVzXHJcblx0XHRodG1sLnF1ZXJ5U2VsZWN0b3JBbGwoXCJkaXYgaDEsIGRpdiAuaW5saW5lLXRpdGxlXCIpLmZvckVhY2goKGVsZW1lbnQpID0+XHJcblx0XHR7XHJcblx0XHRcdGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIi5oZWFkaW5nLWNvbGxhcHNlLWluZGljYXRvclwiKT8ucmVtb3ZlKCk7XHJcblx0XHR9KTtcclxuXHJcblx0XHQvLyByZW1vdmUgYWxsIG5ldyBsaW5lcyBmcm9tIGhlYWRlciBlbGVtZW50cyB3aGljaCBjYXVzZSBzcGFjaW5nIGlzc3Vlc1xyXG5cdFx0aHRtbC5xdWVyeVNlbGVjdG9yQWxsKFwiaDEsIGgyLCBoMywgaDQsIGg1LCBoNlwiKS5mb3JFYWNoKChlbCkgPT4gZWwuaW5uZXJIVE1MID0gZWwuaW5uZXJIVE1MLnJlcGxhY2VBbGwoXCJcXG5cIiwgXCJcIikpO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRoZW1lVG9nZ2xlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIDogSFRNTEVsZW1lbnRcclxuXHR7XHJcblx0XHRsZXQgdG9nZ2xlID0gY29udGFpbmVyLmNyZWF0ZURpdigpO1xyXG5cdFx0bGV0IGxhYmVsID0gdG9nZ2xlLmNyZWF0ZUVsKFwibGFiZWxcIik7XHJcblx0XHRsZXQgaW5wdXQgPSBsYWJlbC5jcmVhdGVFbChcImlucHV0XCIpO1xyXG5cdFx0bGV0IGRpdiA9IGxhYmVsLmNyZWF0ZURpdigpO1xyXG5cclxuXHRcdGxhYmVsLmNsYXNzTGlzdC5hZGQoXCJ0aGVtZS10b2dnbGUtY29udGFpbmVyXCIpO1xyXG5cdFx0bGFiZWwuc2V0QXR0cmlidXRlKFwiZm9yXCIsIFwidGhlbWVfdG9nZ2xlXCIpO1xyXG5cclxuXHRcdGlucHV0LmNsYXNzTGlzdC5hZGQoXCJ0aGVtZS10b2dnbGUtaW5wdXRcIik7XHJcblx0XHRpbnB1dC5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsIFwiY2hlY2tib3hcIik7XHJcblx0XHRpbnB1dC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInRoZW1lX3RvZ2dsZVwiKTtcclxuXHJcblx0XHRkaXYuY2xhc3NMaXN0LmFkZChcInRvZ2dsZS1iYWNrZ3JvdW5kXCIpO1xyXG5cclxuXHRcdHJldHVybiB0b2dnbGU7XHJcblx0fVxyXG5cdFxyXG59XHJcbiJdfQ==