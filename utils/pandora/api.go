package pandora

import (
	"encoding/json"
	"reflect"
)

func MapToStructWithJson(m map[string]interface{}, s interface{}) (err error) {
	var marshal []byte
	marshal, err = json.Marshal(m)
	if err != nil {
		return err
	}
	err = json.Unmarshal(marshal, s)
	return
}
func IsZeroValue(v interface{}) bool {
	return reflect.DeepEqual(v, reflect.Zero(reflect.TypeOf(v)).Interface())
}

func StructToMap(i interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	val := reflect.ValueOf(i)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	// Make sure this is a struct
	if val.Kind() != reflect.Struct {
		return nil
	}

	typ := val.Type()

	for j := 0; j < val.NumField(); j++ {
		field := typ.Field(j)
		value := val.Field(j)
		if value.CanInterface() {
			result[field.Name] = value.Interface()
		}
	}

	return result
}
