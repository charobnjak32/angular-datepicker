'use strict';
var Module = angular.module('datePicker', []);

Module.constant('datePickerConfig', {
  template: 'templates/datepicker.html',
  view: 'month',
  views: ['year', 'month', 'date', 'hours', 'minutes'],
  momentNames: {
    year: 'year',
    month: 'month',
    date: 'day',
    hours: 'hours',
    minutes: 'minutes',
  },
  viewConfig: {
    year: ['years', 'isSameYear'],
    month: ['months', 'isSameMonth'],
    hours: ['hours', 'isSameHour'],
    minutes: ['minutes', 'isSameMinutes'],
  },
  step: 5
});

//Moment format filter.
Module.filter('mFormat', function () {
  return function (m, format, tz) {
    if (!(moment.isMoment(m))) {
      return moment(m).format(format);
    }
    return tz ? moment.tz(m, tz).format(format) : m.format(format);
  };
});

Module.directive('datePicker', ['datePickerConfig', 'datePickerUtils', function datePickerDirective(datePickerConfig, datePickerUtils) {

  //noinspection JSUnusedLocalSymbols
  return {
    // this is a bug ?
    require: '?ngModel',
    template: '<div ng-include="template"></div>',
    scope: {
      model: '=datePicker',
      after: '=?',
      before: '=?'
    },
    link: function (scope, element, attrs, ngModel) {
      function prepareViews() {
        scope.views = datePickerConfig.views.concat();
        scope.view = attrs.view || datePickerConfig.view;

        scope.views = scope.views.slice(
          scope.views.indexOf(attrs.maxView || 'year'),
          scope.views.indexOf(attrs.minView || 'minutes') + 1
        );

        if (scope.views.length === 1 || scope.views.indexOf(scope.view) === -1) {
          scope.view = scope.views[0];
        }
      }

      function getDate(name) {
        return datePickerUtils.getDate(scope, attrs, name);
      }

      var arrowClick = false,
        tz = scope.tz = attrs.timezone,
        createMoment = datePickerUtils.createMoment,
        eventIsForPicker = datePickerUtils.eventIsForPicker,
        step = parseInt(attrs.step || datePickerConfig.step, 10),
        partial = !!attrs.partial,
        minDate = getDate('minDate'),
        maxDate = getDate('maxDate'),
        pickerID = element[0].id,
        highlightNow = !!attrs.highlightNow,
        now = scope.now = createMoment(),
        autoclose = attrs.autoClose === 'true',
      // Either gets the 1st day from the attributes, or asks moment.js to give it to us as it is localized.
        firstDay = attrs.firstDay && attrs.firstDay >= 0 && attrs.firstDay <= 6 ? parseInt(attrs.firstDay, 10) : moment().weekday(0).day(),
        setDate,
        prepareViewData,
        isSame,
        clipDate,
        isNow,
        inValidRange;

      clipDate = function (date) {
        if (minDate && minDate.isAfter(date)) {
          return minDate;
        } else if (maxDate && maxDate.isBefore(date)) {
          return maxDate;
        } else {
          return date;
        }
      };

      scope.modelDate = scope.model ? clipDate(createMoment(scope.model)) : null;
      scope.viewDate = clipDate(createMoment(scope.model || now));

      datePickerUtils.setParams(tz, firstDay);

      scope.template = attrs.template || datePickerConfig.template;

      scope.watchDirectChanges = attrs.watchDirectChanges !== undefined;
      scope.callbackOnSetDate = attrs.dateChange ? datePickerUtils.findFunction(scope, attrs.dateChange) : undefined;

      prepareViews();

      scope.setView = function (nextView) {
        if (scope.views.indexOf(nextView) !== -1) {
          scope.view = nextView;
        }
      };

      scope.selectDate = function (date) {
        if (attrs.disabled) {
          return false;
        }

        // if the date is the same as before, use the same object instead of the new one
        if (isSame(scope.viewDate, date)) {
          date = scope.viewDate;
        }
        date = clipDate(date);
        if (!date) {
          return false;
        }

        var nextView = scope.views[scope.views.indexOf(scope.view) + 1];
        if ((!nextView || partial) || scope.model) {
          setDate(date);
        }

        // if there is a next view then set that as the current view
        // if there is no next view and autoclose is set to true, close the picker
        // if there is no next view and autoclose is not set to true, update the classes
        if (nextView) {
          scope.setView(nextView);
        } else if (autoclose) {
          element.addClass('hidden');
          scope.$emit('hidePicker');
        } else {
          prepareViewData();
        }
      };

      setDate = function (date) {
        if (date) {
          scope.viewDate = scope.modelDate = scope.model = date;
          if (ngModel) {
            ngModel.$setViewValue(date);
          }
        }
        scope.$emit('setDate', scope.model, scope.view);
        //This is duplicated in the new functionality.
        if (scope.callbackOnSetDate) {
          scope.callbackOnSetDate(attrs.datePicker, scope.model);
        }
      };

      function update() {
        var view = scope.view;
        datePickerUtils.setParams(tz, firstDay);

        var viewDate = scope.viewDate;

        // use the view date to determine what is visible
        switch (view) {
          case 'year':
            scope.years = datePickerUtils.getVisibleYears(viewDate);
            break;
          case 'month':
            scope.months = datePickerUtils.getVisibleMonths(viewDate);
            break;
          case 'date':
            scope.weekdays = scope.weekdays || datePickerUtils.getDaysOfWeek();
            scope.weeks = datePickerUtils.getVisibleWeeks(viewDate);
            break;
          case 'hours':
            scope.hours = datePickerUtils.getVisibleHours(viewDate);
            break;
          case 'minutes':
            scope.minutes = datePickerUtils.getVisibleMinutes(viewDate, step);
            break;
        }

        prepareViewData();
      }

      function watch() {
        if (scope.view !== 'date') {
          return scope.view;
        }
        return scope.viewDate ? scope.viewDate.month() : null;
      }

      scope.$watch(watch, update);

      if (scope.watchDirectChanges) {
        scope.$watch('model', function (newValue) {
          // update view date to reflect a new model value
          // view date will ensure that the new model date is visible
          if (newValue) {
            scope.viewDate = createMoment(scope.model);
          }
          arrowClick = false;
          update();
        });
      }

      prepareViewData = function () {
        var view = scope.view,
          date = scope.viewDate,
          classes = [], classList = [],
          i, j;

        datePickerUtils.setParams(tz, firstDay);

        if (view === 'date') {
          var weeks = scope.weeks, week;
          for (i = 0; i < weeks.length; i++) {
            week = weeks[i];
            classes.push([]);
            for (j = 0; j < week.length; j++) {
              classList = [];
              if (datePickerUtils.isSameDay(scope.model, week[j])) {
                classList.push('active');
              }
              if (highlightNow && isNow(week[j], view)) {
                classList.push('now');
              }
              //if (week[j].month() !== date.month()) classList += ' disabled';
              if (!inValidRange(week[j])) {
                classList.push('disabled');
              }

              if (week[j].month() !== date.month()) {
                classList.push('not-current-month');
              }
              classes[i].push(classList.join(' '));
            }
          }
        } else {
          var params = datePickerConfig.viewConfig[view],
            dates = scope[params[0]],
            compareFunc = params[1];

          for (i = 0; i < dates.length; i++) {
            classList = [];
            if (datePickerUtils[compareFunc](date, dates[i])) {
              classList.push('active');
            }
            if (highlightNow && isNow(dates[i], view)) {
              classList.push('now');
            }
            if (!inValidRange(dates[i])) {
              classList.push('disabled');
            }
            classes.push(classList.join(' '));
          }
        }
        scope.classes = classes;
      };

      scope.next = function (delta) {
        var date = moment(scope.viewDate);
        delta = delta || 1;
        switch (scope.view) {
          case 'year':
          /*falls through*/
          case 'month':
            date.year(date.year() + delta);
            break;
          case 'date':
            date.month(date.month() + delta);
            break;
          case 'hours':
          /*falls through*/
          case 'minutes':
            date.hours(date.hours() + delta);
            break;
        }
        date = clipDate(date);
        if (date) {
          scope.viewDate = date;
          arrowClick = true;
          update();
        }
      };

      inValidRange = function (date) {
        var valid = true;
        if (minDate && minDate.isAfter(date)) {
          valid = isSame(minDate, date);
        }
        if (maxDate && maxDate.isBefore(date)) {
          valid &= isSame(maxDate, date);
        }
        return valid;
      };

      isSame = function (date1, date2) {
        return date1.isSame(date2, datePickerConfig.momentNames[scope.view]) ? true : false;
      };



      isNow = function (date, view) {
        var is = true;

        switch (view) {
          case 'minutes':
            is &= ~~(now.minutes() / step) === ~~(date.minutes() / step);
          /* falls through */
          case 'hours':
            is &= now.hours() === date.hours();
          /* falls through */
          case 'date':
            is &= now.date() === date.date();
          /* falls through */
          case 'month':
            is &= now.month() === date.month();
          /* falls through */
          case 'year':
            is &= now.year() === date.year();
        }
        return is;
      };

      scope.prev = function (delta) {
        return scope.next(-delta || -1);
      };

      if (pickerID) {
        scope.$on('pickerUpdate', function (event, pickerIDs, data) {
          if (eventIsForPicker(pickerIDs, pickerID)) {
            var updateViews = false, updateViewData = false;

            if (angular.isDefined(data.minDate)) {
              minDate = data.minDate ? createMoment(data.minDate) : false;
              if (minDate) {
                scope.viewDate = clipDate(scope.viewDate);
              }
              updateViewData = true;
            }
            if (angular.isDefined(data.maxDate)) {
              maxDate = data.maxDate ? data.maxDate : false;
              if (maxDate) {
                scope.viewDate = clipDate(scope.viewDate);
              }
              updateViewData = true;
            }

            if (angular.isDefined(data.minView)) {
              attrs.minView = data.minView;
              updateViews = true;
            }
            if (angular.isDefined(data.maxView)) {
              attrs.maxView = data.maxView;
              updateViews = true;
            }
            attrs.view = data.view || attrs.view;

            if (updateViews) {
              prepareViews();
            }

            if (updateViewData) {
              update();
            }
          }
        });
      }
    }
  };
}]);
