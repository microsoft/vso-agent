// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#import <UIKit/UIKit.h>
#import "MSWebReferenceModel.h"

@class MSDetailViewController;

@interface MSMasterViewController : UITableViewController

@property (strong, nonatomic) MSDetailViewController *detailViewController;

- (void)initialize;

@end
