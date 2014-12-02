// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import "MSDetailViewController.h"

@interface MSDetailViewController ()
@property (strong, nonatomic) UIPopoverController *masterPopoverController;
- (void)configureView;
@end

@implementation MSDetailViewController

- (void)dealloc
{
    [_detailItem release];
    [_urlButton release];
    [_masterPopoverController release];
    [super dealloc];
}

#pragma mark - Managing the detail item

- (void)setDetailItem:(MSWebReference*)newDetailItem
{
    NSLog(@"DetailView::setDetailItem: %@", newDetailItem.description);
    if (_detailItem != newDetailItem) {
        [_detailItem release];
        _detailItem = [newDetailItem retain];

        // Update the view.
        [self configureView];
    }

    if (self.masterPopoverController != nil) {
        [self.masterPopoverController dismissPopoverAnimated:YES];
    }        
}

- (void)configureView
{
    // Update the user interface for the detail item.

    if (self.detailItem) {
        self.title = self.detailItem.resourceName;
        [self.urlButton setTitle:self.detailItem.resourceURL.description forState:UIControlStateNormal];
        [self.webView loadRequest:[NSURLRequest requestWithURL:self.detailItem.resourceURL]];
    }
}

- (void)viewDidLoad
{
    NSLog(@"MSDetailsViewController::viewDidLoad");    
    [super viewDidLoad];
    [self.webView setDelegate:self];
    
    // we create the loading view but don't add it to the view hierarchy
    // before we load the web view request, we add and on complete, we remove
    CGRect activityFrame = CGRectMake(0, 0, 100, 100);
    MSLoadingView *loading = [[[MSLoadingView alloc] initWithFrame:activityFrame] autorelease];
    [loading setCenter:[[self view] center]];
    [self setActivityView:loading];
    
    [self configureView];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}

- (id)initWithNibName:(NSString *)nibNameOrNil bundle:(NSBundle *)nibBundleOrNil
{
    self = [super initWithNibName:nibNameOrNil bundle:nibBundleOrNil];
    if (self) {
        self.title = @"";
    }
    return self;
}
							
#pragma mark - Split view

- (void)splitViewController:(UISplitViewController *)splitController willHideViewController:(UIViewController *)viewController withBarButtonItem:(UIBarButtonItem *)barButtonItem forPopoverController:(UIPopoverController *)popoverController
{
    barButtonItem.title = NSLocalizedString(@"TFS & iOS", @"TFS & iOS");
    [self.navigationItem setLeftBarButtonItem:barButtonItem animated:YES];
    self.masterPopoverController = popoverController;
}

- (void)splitViewController:(UISplitViewController *)splitController willShowViewController:(UIViewController *)viewController invalidatingBarButtonItem:(UIBarButtonItem *)barButtonItem
{
    // Called when the view is shown again in the split view, invalidating the button and popover controller.
    [self.navigationItem setLeftBarButtonItem:nil animated:YES];
    self.masterPopoverController = nil;
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark UIWebViewDelegate
#pragma mark -
///////////////////////////////////////////////////////////////////////////

- (void) webViewDidStartLoad:(UIWebView *)webView {
    NSLog(@"webViewDidStartLoad");
    [[self view] addSubview:[self activityView]];
}

- (void) webViewDidFinishLoad:(UIWebView *)webView {
    NSLog(@"webViewDidFinishLoad");
    [[self activityView] removeFromSuperview];
}

///////////////////////////////////////////////////////////////////////////
#pragma mark -
#pragma mark Actions
#pragma mark -
///////////////////////////////////////////////////////////////////////////
- (IBAction)clickUrl: (id)sender
{
    [[UIApplication sharedApplication] openURL:self.detailItem.resourceURL];
}

@end
