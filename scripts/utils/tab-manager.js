import { __awaiter } from "tslib";
import { RenderLog } from "scripts/html-generation/render-log";
export var TabManager;
(function (TabManager) {
    function getLeaf(navType, splitDirection = 'vertical') {
        let leaf = navType === 'split' ? app.workspace.getLeaf(navType, splitDirection) : app.workspace.getLeaf(navType);
        return leaf;
    }
    function openFileInNewTab(file, navType, splitDirection = 'vertical') {
        return __awaiter(this, void 0, void 0, function* () {
            let leaf = getLeaf(navType, splitDirection);
            try {
                yield leaf.openFile(file, undefined).catch((reason) => {
                    RenderLog.log(reason);
                });
            }
            catch (error) {
                RenderLog.log(error);
            }
            return leaf;
        });
    }
    TabManager.openFileInNewTab = openFileInNewTab;
    function openNewTab(navType, splitDirection = 'vertical') {
        return getLeaf(navType, splitDirection);
    }
    TabManager.openNewTab = openNewTab;
})(TabManager || (TabManager = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFiLW1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0YWItbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQ0EsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBRy9ELE1BQU0sS0FBVyxVQUFVLENBK0IxQjtBQS9CRCxXQUFpQixVQUFVO0lBRTFCLFNBQVMsT0FBTyxDQUFDLE9BQTJCLEVBQUUsaUJBQWlDLFVBQVU7UUFFeEYsSUFBSSxJQUFJLEdBQUcsT0FBTyxLQUFLLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNqSCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFRCxTQUFzQixnQkFBZ0IsQ0FBQyxJQUFXLEVBQUUsT0FBMkIsRUFBRSxpQkFBaUMsVUFBVTs7WUFFM0gsSUFBSSxJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQztZQUU1QyxJQUNBO2dCQUNDLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7b0JBRXJELFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZCLENBQUMsQ0FBQyxDQUFDO2FBQ0g7WUFDRCxPQUFPLEtBQUssRUFDWjtnQkFDQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3JCO1lBRUQsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO0tBQUE7SUFqQnFCLDJCQUFnQixtQkFpQnJDLENBQUE7SUFFRCxTQUFnQixVQUFVLENBQUMsT0FBMkIsRUFBRSxpQkFBaUMsVUFBVTtRQUVsRyxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUhlLHFCQUFVLGFBR3pCLENBQUE7QUFDRixDQUFDLEVBL0JnQixVQUFVLEtBQVYsVUFBVSxRQStCMUIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyAgUGFuZVR5cGUsIFNwbGl0RGlyZWN0aW9uLCBURmlsZSwgVmlldywgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xyXG5pbXBvcnQgeyBSZW5kZXJMb2cgfSBmcm9tIFwic2NyaXB0cy9odG1sLWdlbmVyYXRpb24vcmVuZGVyLWxvZ1wiO1xyXG5cclxuXHJcbmV4cG9ydCBuYW1lc3BhY2UgVGFiTWFuYWdlclxyXG57XHJcblx0ZnVuY3Rpb24gZ2V0TGVhZihuYXZUeXBlOiBQYW5lVHlwZSB8IGJvb2xlYW4sIHNwbGl0RGlyZWN0aW9uOiBTcGxpdERpcmVjdGlvbiA9ICd2ZXJ0aWNhbCcpOiBXb3Jrc3BhY2VMZWFmXHJcblx0e1xyXG5cdFx0bGV0IGxlYWYgPSBuYXZUeXBlID09PSAnc3BsaXQnID8gYXBwLndvcmtzcGFjZS5nZXRMZWFmKG5hdlR5cGUsIHNwbGl0RGlyZWN0aW9uKSA6IGFwcC53b3Jrc3BhY2UuZ2V0TGVhZihuYXZUeXBlKTtcclxuXHRcdHJldHVybiBsZWFmO1xyXG5cdH1cclxuXHJcblx0ZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5GaWxlSW5OZXdUYWIoZmlsZTogVEZpbGUsIG5hdlR5cGU6IFBhbmVUeXBlIHwgYm9vbGVhbiwgc3BsaXREaXJlY3Rpb246IFNwbGl0RGlyZWN0aW9uID0gJ3ZlcnRpY2FsJyk6IFByb21pc2U8V29ya3NwYWNlTGVhZj4gXHJcblx0e1xyXG5cdFx0bGV0IGxlYWYgPSBnZXRMZWFmKG5hdlR5cGUsIHNwbGl0RGlyZWN0aW9uKTtcclxuXHJcblx0XHR0cnlcclxuXHRcdHtcclxuXHRcdFx0YXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlLCB1bmRlZmluZWQpLmNhdGNoKChyZWFzb24pID0+XHJcblx0XHRcdHtcclxuXHRcdFx0XHRSZW5kZXJMb2cubG9nKHJlYXNvbik7XHJcblx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdFx0Y2F0Y2ggKGVycm9yKVxyXG5cdFx0e1xyXG5cdFx0XHRSZW5kZXJMb2cubG9nKGVycm9yKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbGVhZjtcclxuXHR9XHJcblxyXG5cdGV4cG9ydCBmdW5jdGlvbiBvcGVuTmV3VGFiKG5hdlR5cGU6IFBhbmVUeXBlIHwgYm9vbGVhbiwgc3BsaXREaXJlY3Rpb246IFNwbGl0RGlyZWN0aW9uID0gJ3ZlcnRpY2FsJyk6IFdvcmtzcGFjZUxlYWZcclxuXHR7XHJcblx0XHRyZXR1cm4gZ2V0TGVhZihuYXZUeXBlLCBzcGxpdERpcmVjdGlvbik7XHJcblx0fVxyXG59XHJcblxyXG4iXX0=